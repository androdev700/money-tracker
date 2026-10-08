import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Category, type Txn } from './api';

interface Store {
  version: number;
  refresh: () => void;
  categories: Category[];
  editing: Partial<Txn> | null;
  openEditor: (txn: Partial<Txn> | null) => void;
  path: string;
  search: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, openEditor] = useState<Partial<Txn> | null>(null);
  const [loc, setLoc] = useState(() => ({ path: location.pathname, search: location.search }));

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) history.replaceState(null, '', to);
    else {
      history.pushState(null, '', to);
      window.scrollTo(0, 0);
    }
    setLoc({ path: location.pathname, search: location.search });
  }, []);

  useEffect(() => {
    const onPop = () => setLoc({ path: location.pathname, search: location.search });
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    api.get<Category[]>('/api/categories').then(setCategories).catch(() => {});
  }, [version]);

  // Data synced in the background shows up when you come back to the app.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{ version, refresh, categories, editing, openEditor, path: loc.path, search: new URLSearchParams(loc.search), navigate }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function useApi<T>(path: string | null) {
  const { version } = useStore();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });

  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    api
      .get<T>(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => {
      live = false;
    };
  }, [path, version]);

  return state;
}

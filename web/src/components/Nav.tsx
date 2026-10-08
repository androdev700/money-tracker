import type { Status } from '../lib/api';
import { useApi, useStore } from '../lib/store';
import { TabIcon, type TabSymbol } from './Icons';

const ITEMS: { path: string; label: string; icon: TabSymbol }[] = [
  { path: '/', label: 'Month', icon: 'month' },
  { path: '/transactions', label: 'Transactions', icon: 'list' },
  { path: '/review', label: 'Review', icon: 'review' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export function Nav() {
  const { path, navigate } = useStore();
  const { data: status } = useApi<Status>('/api/status');
  const badge = (status?.reviewCount ?? 0) + (status?.unparsedCount ?? 0);

  const link = (it: (typeof ITEMS)[number], variant: 'tab' | 'side') => {
    const active = path === it.path;
    const count = it.path === '/review' && badge > 0 ? badge : 0;
    return (
      <a
        key={it.path}
        href={it.path}
        onClick={(e) => {
          e.preventDefault();
          navigate(it.path);
        }}
        aria-current={active ? 'page' : undefined}
        aria-label={count ? `${it.label}, ${count} to review` : undefined}
        className={
          variant === 'tab'
            ? `relative flex min-w-0 flex-1 flex-col items-center justify-start gap-0.5 pt-1.5 ${active ? 'text-accent-text' : 'text-label-2'}`
            : `tap flex h-11 items-center gap-3 rounded-lg px-3 text-body ${active ? 'bg-fill font-semibold' : ''}`
        }
      >
        <span className={variant === 'side' ? 'text-accent' : 'relative'}>
          <TabIcon name={it.icon} filled={active} className={variant === 'tab' ? 'size-[1.625rem]' : 'size-[1.375rem]'} />
          {variant === 'tab' && count > 0 && (
            <span className="absolute -top-1 left-[1.125rem] min-w-[1.125rem] rounded-full bg-danger px-[0.3125rem] text-center text-[0.75rem] leading-[1.125rem] font-medium text-white" aria-hidden>
              {count}
            </span>
          )}
        </span>
        <span className={variant === 'tab' ? 'max-w-full truncate text-[0.625rem] leading-3 font-medium' : 'min-w-0 flex-1 truncate'}>{it.label}</span>
        {variant === 'side' && count > 0 && (
          <span className="text-subhead text-label-2" aria-hidden>
            {count}
          </span>
        )}
      </a>
    );
  };

  return (
    <>
      <nav aria-label="Main" className="material hairline-t fixed inset-x-0 bottom-0 z-30 flex h-[calc(3.0625rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITEMS.map((it) => link(it, 'tab'))}
      </nav>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-0.5 bg-card/60 px-3 pt-[max(1rem,env(safe-area-inset-top))] shadow-[inset_calc(-1*var(--hairline))_0_0_var(--separator)] md:flex">
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-4">
          <img src="/icon.svg" alt="" className="size-8 rounded-[0.5rem]" />
          <span className="text-title2 font-bold">Money</span>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {ITEMS.map((it) => link(it, 'side'))}
        </nav>
      </aside>
    </>
  );
}

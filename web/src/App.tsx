import { Nav } from './components/Nav';
import { TxnSheet } from './components/TxnSheet';
import { MonthPage } from './pages/Month';
import { ReviewPage } from './pages/Review';
import { SettingsPage } from './pages/Settings';
import { TransactionsPage } from './pages/Transactions';
import { useStore } from './lib/store';

const PAGES: Record<string, () => React.JSX.Element> = {
  '/': MonthPage,
  '/transactions': TransactionsPage,
  '/review': ReviewPage,
  '/settings': SettingsPage,
};

export function App() {
  const { path, openEditor } = useStore();
  const Page = PAGES[path] ?? MonthPage;
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28 md:pl-60 md:pb-10 lg:pl-64">
        <Page />
      </main>
      <button
        onClick={() => openEditor({})}
        aria-label="Add spend"
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-accent text-3xl text-on-accent shadow-lg md:right-8 md:bottom-8"
      >
        +
      </button>
      <TxnSheet />
    </>
  );
}

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
  const { path } = useStore();
  const Page = PAGES[path] ?? MonthPage;
  return (
    <>
      <Nav />
      <main className="gutter pb-[calc(3.0625rem+env(safe-area-inset-bottom)+2rem)] md:ml-64 md:pb-16">
        <Page />
      </main>
      <TxnSheet />
    </>
  );
}

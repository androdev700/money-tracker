import type { ReactNode } from 'react';
import { useApi, useStore } from '../lib/store';
import type { Status } from '../lib/api';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ITEMS: { path: string; label: string; icon: ReactNode }[] = [
  { path: '/', label: 'Month', icon: <Icon d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { path: '/transactions', label: 'All', icon: <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
  { path: '/review', label: 'Review', icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
  { path: '/settings', label: 'Settings', icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /> },
];

export function Nav() {
  const { path, navigate } = useStore();
  const { data: status } = useApi<Status>('/api/status');
  const badge = (status?.reviewCount ?? 0) + (status?.unparsedCount ?? 0);

  const item = (it: (typeof ITEMS)[number], variant: 'bar' | 'side') => {
    const active = path === it.path;
    return (
      <a
        key={it.path}
        href={it.path}
        onClick={(e) => {
          e.preventDefault();
          navigate(it.path);
        }}
        aria-current={active ? 'page' : undefined}
        className={
          variant === 'bar'
            ? `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-accent' : 'text-muted'}`
            : `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? 'bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-sunken'}`
        }
      >
        {it.icon}
        <span>{it.label}</span>
        {it.path === '/review' && badge > 0 && (
          <span
            className={`rounded-full bg-ink px-1.5 text-[10px] font-semibold leading-4 text-bg ${variant === 'bar' ? 'absolute top-1 left-1/2 ml-2' : 'ml-auto'}`}
          >
            {badge}
          </span>
        )}
      </a>
    );
  };

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-card/95 backdrop-blur md:hidden">
        {ITEMS.map((it) => item(it, 'bar'))}
      </nav>
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col gap-1 border-r border-line bg-card p-4 md:flex">
        <div className="mb-4 flex items-center gap-2 px-3 text-lg font-semibold">
          <img src="/icon.svg" alt="" className="size-7" /> Money
        </div>
        {ITEMS.map((it) => item(it, 'side'))}
      </aside>
    </>
  );
}

import { useStore } from '../lib/store';

export function ToastHost() {
  const { toast, dismissToast } = useStore();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-8">
      <div
        key={toast.id}
        role="status"
        className="pointer-events-auto flex max-w-full animate-toast-in items-center gap-4 rounded-full bg-ink py-2.5 pr-2.5 pl-5 text-sm text-bg shadow-lg"
      >
        <span className="min-w-0 truncate">{toast.message}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.run();
              dismissToast();
            }}
            className="shrink-0 rounded-full bg-bg/15 px-3 py-1 font-semibold"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

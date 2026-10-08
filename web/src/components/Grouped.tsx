import type { ReactNode } from 'react';

/** An inset grouped section: small header, a rounded card of cells, and an optional footer. */
export function Section({ header, aside, footer, children, className = '', card = 'bg-card' }: {
  header?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Classes for the grouped card; null renders the children bare (for a stack of cards). */
  card?: string | null;
}) {
  return (
    <section className={className}>
      {header && (
        <h2 className="flex items-baseline justify-between gap-3 px-4 pb-1.5 text-footnote text-label-2 uppercase">
          <span className="min-w-0 truncate">{header}</span>
          {aside && <span className="shrink-0 normal-case">{aside}</span>}
        </h2>
      )}
      {card === null ? children : <div className={`overflow-hidden rounded-xl ${card}`}>{children}</div>}
      {footer && <div className="px-4 pt-1.5 text-footnote text-label-2">{footer}</div>}
    </section>
  );
}

/** Health-style section title for dashboard content, with an optional trailing action. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-end justify-between gap-3 pb-2">
      <h2 className="min-w-0 truncate text-title3 font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div role="radiogroup" aria-label={label} className="relative grid h-8 rounded-[0.5625rem] bg-fill p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="segment-thumb absolute inset-y-0.5 left-0.5 rounded-[0.4375rem]"
        style={{ width: `calc((100% - 0.25rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map(([v, text], i) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={`relative truncate px-2 text-footnote ${v === value ? 'font-semibold' : ''} ${i > 0 && i !== index && i !== index + 1 ? 'before:absolute before:inset-y-2 before:left-0 before:w-px before:bg-separator' : ''}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

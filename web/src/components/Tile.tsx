/** A category's emoji on a tint of its colour. */
export function Tile({ icon, color, size = 'md' }: { icon: string | null | undefined; color: string | null | undefined; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`tile ${size === 'sm' ? 'size-8 text-base' : 'size-11 text-xl'}`}
      style={{ '--tile': color ?? undefined } as React.CSSProperties}
      aria-hidden
    >
      {icon ?? '❔'}
    </span>
  );
}

import { useMemo } from 'react';
import type { Category } from '../lib/api';
import { useStore } from '../lib/store';
import { Glyph, type GlyphName } from './Icons';

// Categories store an emoji. Known ones are drawn as a white glyph on the category colour,
// Settings-app style; anything else keeps the user's emoji on a soft tint of that colour.
const EMOJI_GLYPH: Record<string, GlyphName> = {
  '🍜': 'food', '🍔': 'food', '🍕': 'food', '🍽': 'food', '🍱': 'food', '🥘': 'food', '🍛': 'food',
  '🛒': 'cart', '🥦': 'cart', '🧺': 'cart',
  '🏠': 'home', '🏡': 'home', '🏘': 'home',
  '🚗': 'car', '🚙': 'car', '🚘': 'car', '🏍': 'car', '🛵': 'car',
  '⛽': 'fuel',
  '🛍': 'bag', '👜': 'bag', '👗': 'bag',
  '💊': 'pill', '🏥': 'pill', '⚕': 'pill', '🩺': 'pill',
  '👤': 'person', '🧑': 'person', '💇': 'person', '🧴': 'person',
  '🍺': 'mug', '🍻': 'mug', '☕': 'mug',
  '🍷': 'wine', '🍸': 'wine', '🥂': 'wine', '🍹': 'wine',
};

const SIZES = {
  sm: { box: 'size-[1.375rem] rounded-[0.3125rem]', glyph: 'size-[0.875rem]', emoji: 'text-[0.75rem]' },
  md: { box: 'size-[1.875rem] rounded-[0.4375rem]', glyph: 'size-[1.125rem]', emoji: 'text-[1rem]' },
  lg: { box: 'size-[2.25rem] rounded-[0.5rem]', glyph: 'size-[1.375rem]', emoji: 'text-[1.25rem]' },
};

const NEUTRAL = '#8e8e93';

export function CategoryTile({ icon, color, glyph, size = 'md' }: { icon?: string | null; color?: string | null; glyph?: GlyphName; size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  const name = glyph ?? (icon ? EMOJI_GLYPH[icon.replace(/️/g, '')] : 'question');
  if (name || !icon) {
    return (
      <span className={`grid shrink-0 place-items-center text-white ${s.box}`} style={{ background: color ?? NEUTRAL }} aria-hidden>
        <Glyph name={name ?? 'question'} className={s.glyph} strokeWidth={2} />
      </span>
    );
  }
  return (
    <span className={`grid shrink-0 place-items-center leading-none ${s.box} ${s.emoji}`} style={{ background: `color-mix(in srgb, ${color ?? NEUTRAL} 22%, transparent)` }} aria-hidden>
      {icon}
    </span>
  );
}

export function useCategoryMap() {
  const { categories } = useStore();
  return useMemo(() => new Map<number, Category>(categories.map((c) => [c.id, c])), [categories]);
}

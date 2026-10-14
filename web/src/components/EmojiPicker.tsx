import { useState } from 'react';
import { Picker } from './Picker';

// Icons that suit spending categories, with the words people search for them by.
const EMOJIS: [string, string][] = [
  ['🍜', 'food noodles meal eat'], ['🍕', 'pizza food'], ['🍔', 'burger food fast'], ['🍛', 'curry rice biryani food'], ['🍱', 'bento lunch tiffin'],
  ['🥗', 'salad healthy food'], ['🍰', 'cake dessert sweet'], ['☕', 'coffee tea cafe'], ['🍩', 'donut snack sweet'], ['🥡', 'takeaway delivery food'],
  ['🛒', 'groceries cart shopping supermarket'], ['🥦', 'vegetables groceries veggies'], ['🍎', 'fruit apple groceries'], ['🥛', 'milk dairy groceries'], ['🧺', 'basket laundry groceries'],
  ['🏠', 'home house rent'], ['🏡', 'house garden home family'], ['🛋️', 'furniture sofa home'], ['🧹', 'cleaning broom home maid'], ['🔌', 'electricity power plug bill'],
  ['💡', 'electricity bulb light utilities idea'], ['🪴', 'plant garden home'], ['🛠️', 'tools repair maintenance'], ['🔑', 'key rent deposit'],
  ['👨‍👩‍👧', 'family parents kids'], ['👨‍👩‍👧‍👦', 'family parents children'], ['👪', 'family'], ['👶', 'baby kids child'], ['👵', 'grandma parents elders'],
  ['👴', 'grandpa parents elders'], ['💑', 'couple partner date love'], ['❤️', 'love heart partner'], ['🎁', 'gift present birthday'], ['🎂', 'birthday cake party'],
  ['🚗', 'car vehicle'], ['🏍️', 'motorcycle bike vehicle'], ['🛵', 'scooter bike vehicle'], ['⛽', 'fuel petrol gas'], ['🚕', 'taxi cab uber ola'],
  ['✈️', 'flight travel plane trip'], ['🚆', 'train travel railway'], ['🚌', 'bus travel commute'], ['🅿️', 'parking'], ['🧳', 'travel luggage trip holiday'],
  ['🏨', 'hotel stay travel'], ['🗺️', 'trip travel map holiday'],
  ['💊', 'health medicine pharmacy'], ['🏥', 'hospital health doctor'], ['🩺', 'doctor health checkup'], ['🦷', 'dentist teeth health'], ['💪', 'gym fitness workout'],
  ['🧘', 'yoga wellness fitness'],
  ['🛍️', 'shopping bags'], ['👕', 'clothes tshirt shopping'], ['👟', 'shoes sneakers'], ['👗', 'dress clothes fashion'], ['📱', 'phone mobile recharge'],
  ['💻', 'laptop computer electronics'], ['🎧', 'headphones music electronics'], ['⌚', 'watch accessories'],
  ['👤', 'personal self me'], ['💇', 'haircut salon grooming'], ['💅', 'beauty nails salon'], ['🧴', 'skincare toiletries personal care'], ['📚', 'books reading education'],
  ['🎬', 'movies cinema entertainment'], ['🎮', 'games gaming entertainment'], ['🎵', 'music subscription spotify'], ['🎟️', 'tickets events entertainment'], ['📺', 'tv streaming netflix subscription'],
  ['🍺', 'beer drinks bar'], ['🍷', 'wine drinks'], ['🍸', 'cocktail drinks party'], ['🥂', 'celebration drinks party'],
  ['📶', 'internet wifi broadband bill'], ['🧾', 'bills receipt invoice'], ['💳', 'card credit payment'], ['🏦', 'bank emi loan'], ['💰', 'money savings cash'],
  ['📈', 'investment stocks savings'], ['🛡️', 'insurance protection'], ['💧', 'water bill utilities'], ['🔥', 'gas cooking utilities'], ['⚡', 'electricity power utilities'],
  ['🎓', 'education school college fees'], ['✏️', 'stationery school'], ['🐶', 'dog pet'], ['🐱', 'cat pet'], ['🐾', 'pets animals vet'],
  ['🙏', 'donation charity religion temple'], ['🎉', 'party celebration events'], ['📦', 'delivery package misc'], ['✨', 'misc other special'], ['🏷️', 'misc tag other'],
];

const EMOJI_RE = /\p{Extended_Pictographic}/u;
// ":house_with_garden:" (Slack/GitHub style) → "house with garden"
const FILLER = new Set(['with', 'and', 'of', 'the', 'a', 'for', 'face']);
const words = (q: string) => q.toLowerCase().replace(/[:_-]+/g, ' ').trim().split(/\s+/).filter((w) => w && !FILLER.has(w));

/** A tappable icon box that opens a searchable icon grid; typing or pasting any emoji works too. */
export function EmojiField({ value, onChange, label }: { value: string; onChange: (emoji: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const typed = [...q.trim()].filter((ch) => EMOJI_RE.test(ch)).length ? q.trim() : null;
  const terms = words(q);
  const matches = typed ? [] : EMOJIS.filter(([, keys]) => terms.every((t) => keys.split(' ').some((k) => k.startsWith(t))));

  const pick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
    setQ('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-bg text-xl hover:bg-sunken"
      >
        {value || <span className="text-muted">🙂</span>}
      </button>
      {open && (
        <Picker title="Pick an icon" onClose={() => setOpen(false)}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search (house, family, fuel…) or type an emoji"
            autoFocus
            className="mb-3 w-full rounded-2xl border border-line bg-card px-4 py-3 outline-none focus:border-accent"
          />
          {typed && (
            <button type="button" onClick={() => pick(typed)} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 text-left">
              <span className="text-2xl">{typed}</span>
              <span className="font-semibold text-accent">Use this</span>
            </button>
          )}
          {!typed && matches.length === 0 && <p className="py-6 text-center text-sm text-muted">No icon for “{q}”. Type or paste an emoji instead.</p>}
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {matches.map(([emoji, keys]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                title={keys}
                aria-label={keys.split(' ')[0]}
                aria-pressed={emoji === value}
                className={`grid aspect-square place-items-center rounded-xl text-2xl transition-colors hover:bg-sunken ${emoji === value ? 'bg-accent/15 ring-2 ring-accent' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Picker>
      )}
    </>
  );
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const rupees = (paise: number) => `₹${inr.format(paise / 100)}`;

const inrWhole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
/** For totals, where paise are noise. */
export const rupeesWhole = (paise: number) => `₹${inrWhole.format(Math.round(paise / 100))}`;

export const rupeesShort = (paise: number) => {
  const r = paise / 100;
  const short = (n: number, unit: string) => `₹${Number(n.toFixed(n >= 10 ? 0 : 1))}${unit}`;
  if (r >= 1e7) return short(r / 1e7, 'Cr');
  if (r >= 1e5) return short(r / 1e5, 'L');
  if (r >= 1e3) return short(r / 1e3, 'k');
  return `₹${Math.round(r)}`;
};

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const dayLabel = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const timeLabel = (iso: string) => {
  const t = iso.slice(11, 16);
  if (!t || t === '12:00') return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export const nowLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const relativeTime = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export const capitalise = (s: string | null | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : '');

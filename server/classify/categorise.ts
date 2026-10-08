import type { DB } from '../db.ts';

export interface CategoryMatch {
  categoryId: number;
  by: 'rule' | 'seed' | 'history';
  displayName?: string | null;
}

// Order matters: specific before generic (Swiggy Instamart is groceries, Swiggy is food; a beer cafe is drinks).
// `prefix` terms match the start of a word, so "spotify" also catches "SPOTIFYINDIA" and "hospital" catches
// "Hospitals"; `word` terms are short or ambiguous and must match a whole word.
const SEED: { category: string; prefix: string[]; word?: string[] }[] = [
  {
    category: 'groceries',
    prefix: ['blinkit', 'grofers', 'zepto', 'instamart', 'bigbasket', 'big basket', 'dmart', 'avenue supermart', 'jiomart', 'reliance fresh',
      'reliance smart', 'more retail', 'natures basket', "nature's basket", 'ratnadeep', 'amazon fresh', 'freshtohome', 'fresh to home',
      'licious', 'country delight', 'milkbasket', 'supermarket', 'super market', 'hypermarket', 'hyper market', 'kirana', 'provision',
      'vegetable', 'fruit', 'dairy', 'flipkart minutes', 'star bazaar', 'spencer', 'namdhari'],
    word: ['spar'],
  },
  {
    category: 'drinks',
    prefix: ['wine', 'liquor', 'beer', 'beverage', 'brewer', 'brewpub', 'spirits', 'tavern', 'taproom', 'toit', 'whisky', 'tonique', 'msil'],
    word: ['bar', 'pub', 'social', 'hops', 'brew'],
  },
  {
    category: 'food',
    prefix: ['swiggy', 'zomato', 'eatsure', 'eatclub', 'eatfit', 'box8', 'faasos', 'rebel foods', 'curefood', 'restaurant', 'cafe', 'coffee',
      'starbucks', 'third wave', 'blue tokai', 'chaayos', 'chai point', 'domino', 'pizza', 'mcdonald', 'kfc', 'burger', 'subway', 'haldiram',
      'baker', 'biryani', 'dhaba', 'kitchen', 'food', 'eats', 'sweet', 'bistro', 'diner', 'canteen', 'ice cream', 'icecream', 'gelato',
      'dessert', 'barbeque', 'darshini', 'tiffin', 'idli', 'dosa', 'juice'],
    word: ['tea', 'chai', 'dine', 'caf', 'mtr'],
  },
  {
    category: 'fuel',
    prefix: ['hpcl', 'hp pay', 'hindustan petro', 'iocl', 'indian oil', 'indianoil', 'bpcl', 'bharat petro', 'shell', 'nayara', 'essar oil',
      'jio-bp', 'jio bp', 'jiobp', 'petrol', 'fuel', 'filling station', 'service station', 'servce station', 'petroleum'],
    // COCO = company-owned company-operated, how oil-company pumps are named on card statements.
    word: ['coco'],
  },
  {
    category: 'vehicle',
    prefix: ['fastag', 'netc', 'toll plaza', 'parking', 'car wash', 'tyre', 'motor', 'automobile', 'auto care', 'service cent', 'maruti',
      'hyundai', 'honda', 'tata motors', 'mahindra', 'toyota', 'bajaj', 'hero moto', 'royal enfield', 'ather', 'ola electric', 'carwale',
      'bikewale', 'vehicle insurance', 'motor insurance', 'acko', 'godigit', 'go digit', 'spinny', 'cars24', 'liqui moly', 'motul', 'castrol'],
    word: ['toll', 'puc', 'tvs', 'kia', 'ktm', 'yamaha', 'suzuki'],
  },
  {
    category: 'health',
    prefix: ['apollo', 'pharm', 'medplus', '1mg', 'netmeds', 'truemeds', 'hospital', 'clinic', 'diagnostic', 'pathology', 'path lab', 'dental',
      'dentist', 'practo', 'chemist', 'medical', 'medico', 'healthcare', 'thyrocare', 'lal path', 'metropolis', 'cult fit', 'cultfit',
      'fitness', 'physio', 'ayurved', 'kauvery', 'manipal', 'narayana', 'fortis', 'aster'],
    word: ['gym'],
  },
  {
    category: 'home',
    prefix: ['nobroker', 'nestaway', 'electricity', 'bescom', 'msedcl', 'mseb', 'tata power', 'adani electricity', 'bses', 'torrent power',
      'tneb', 'cesc', 'bwssb', 'airtel xstream', 'jio fiber', 'jiofiber', 'act fibernet', 'hathway', 'broadband', 'indane', 'bharat gas',
      'hp gas', 'mahanagar gas', 'gail gas', 'piped gas', 'maintenance', 'apartment', 'mygate', 'urban company', 'urbanclap', 'ikea',
      'pepperfry', 'home centre', 'homecentre', 'furniture', 'hardware', 'plumb', 'electrician', 'laundry'],
    word: ['rent', 'igl', 'society', 'power', 'water', 'gas'],
  },
  {
    category: 'personal',
    prefix: ['uber', 'rapido', 'namma yatri', 'blusmart', 'irctc', 'redbus', 'makemytrip', 'goibibo', 'cleartrip', 'ixigo', 'yatra', 'airbnb',
      'booking', 'agoda', 'indigo', 'air india', 'akasa', 'vistara', 'spicejet', 'netflix', 'spotify', 'hotstar', 'jiohotstar', 'disney',
      'prime video', 'youtube', 'google', 'apple com', 'itunes', 'icloud', 'audible', 'zee5', 'sonyliv', 'recharge', 'airtel', 'myjio',
      'vodafone', 'bsnl', 'salon', 'barber', 'groom', 'bookmyshow', 'book my show', 'pvr', 'inox', 'cinepolis', 'movie', 'steam',
      'playstation', 'claude', 'openai', 'chatgpt', 'anthropic', 'district'],
    word: ['ola', 'jio', 'vi', 'spa', 'metro', 'oyo'],
  },
  {
    category: 'shopping',
    prefix: ['amazon', 'amzn', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'tata cliq', 'tatacliq', 'croma', 'reliance digital',
      'vijay sales', 'decathlon', 'lifestyle', 'life style', 'westside', 'zara', 'h&m', 'uniqlo', 'shoppers stop', 'pantaloon', 'max fashion',
      'lenskart', 'snapdeal', 'firstcry', 'samsung', 'mall', 'fashion', 'apparel', 'footwear', 'bata', 'puma', 'nike', 'adidas', 'miniso'],
    word: ['boat', 'apple', 'trends'],
  },
];

const term = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
const SEED_RES: [string, RegExp][] = SEED.map(({ category, prefix, word = [] }) => [
  category,
  new RegExp(`\\b(?:${prefix.map(term).join('|')})${word.length ? `|\\b(?:${word.map(term).join('|')})\\b` : ''}`, 'i'),
]);

/** A rule for "bookmyshow" also covers "bookmyshowpayupg"; shorter keys are too generic to extend. */
export const MIN_PREFIX_RULE = 6;

type CatRow = { id: number; name: string };

export function categoryIdByName(db: DB): Map<string, number> {
  const rows = db.prepare('SELECT id, name FROM categories').all() as CatRow[];
  return new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
}

/** Rules learned from your edits win, then the built-in keyword map. */
export function categorise(db: DB, merchantKey: string, haystack: string): CategoryMatch | null {
  const rule = db
    .prepare(
      `SELECT category_id, display_name FROM merchant_rules
       WHERE merchant_key = ?1 OR (length(merchant_key) >= ${MIN_PREFIX_RULE} AND substr(?1, 1, length(merchant_key)) = merchant_key)
       ORDER BY length(merchant_key) DESC LIMIT 1`,
    )
    .get(merchantKey) as { category_id: number; display_name: string | null } | undefined;
  if (rule) return { categoryId: rule.category_id, by: 'rule', displayName: rule.display_name };

  const ids = categoryIdByName(db);
  for (const [name, re] of SEED_RES) {
    if (re.test(merchantKey) || re.test(haystack)) {
      const id = ids.get(name);
      if (id) return { categoryId: id, by: 'seed' };
    }
  }
  return null;
}

/** A refund belongs to the category its original purchase was in. */
export function categoryFromHistory(db: DB, merchantKey: string): CategoryMatch | null {
  const row = db
    .prepare(
      `SELECT category_id FROM transactions WHERE merchant_key = ? AND kind = 'spend' AND category_id IS NOT NULL
       AND deleted_at IS NULL ORDER BY txn_at DESC LIMIT 1`,
    )
    .get(merchantKey) as { category_id: number } | undefined;
  return row ? { categoryId: row.category_id, by: 'history' } : null;
}

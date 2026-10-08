import type { DB } from '../db.ts';

export interface CategoryMatch {
  categoryId: number;
  by: 'rule' | 'seed' | 'history';
  displayName?: string | null;
}

// Order matters: specific before generic (Swiggy Instamart is groceries, Swiggy is food; a beer cafe is drinks).
const SEED: [string, RegExp][] = [
  ['groceries', /\b(blinkit|grofers|zepto|instamart|bigbasket|big basket|dmart|avenue supermarts|jiomart|reliance fresh|reliance smart|more retail|spar|nature'?s basket|ratnadeep|amazon fresh|fresh to home|freshtohome|licious|country delight|milkbasket|supermarket|kirana|provision|vegetables?|fruits?|dairy|flipkart minutes)\b/i],
  ['drinks', /\b(wines?|liquor|beer|beverages|bar|pub|brew(?:ery|ing|pub)?|spirits|tavern|taproom|toit|social|hops|whisky)\b/i],
  ['food', /\b(swiggy|zomato|eatsure|eatclub|box8|faasos|rebel foods|restaurant|cafe|caf|coffee|starbucks|third wave|blue tokai|chaayos|domino'?s|pizza|mcdonald'?s|kfc|burger|subway|haldiram|bakery|bakers|biryani|dhaba|kitchen|foods?|eats|sweets|tea|chai|dine|bistro|diner|canteen)\b/i],
  ['fuel', /\b(hpcl|hp pay|hindustan petroleum|iocl|indian oil|indianoil|bpcl|bharat petroleum|shell|nayara|essar oil|jio-?bp|petrol|fuel|filling station|service station|petroleum)\b/i],
  ['vehicle', /\b(fastag|netc|toll|parking|car wash|tyres?|motors|automobiles?|auto ?care|service cent(?:er|re)|maruti|hyundai|honda|tata motors|mahindra|toyota|kia|bajaj|hero motocorp|royal enfield|tvs|ather|ola electric|carwale|bikewale|vehicle insurance|motor insurance|acko|godigit|go digit|spinny|cars24|puc)\b/i],
  ['health', /\b(apollo|pharmeasy|pharm|pharmacy|medplus|1mg|tata 1mg|netmeds|truemeds|hospital|clinic|diagnostics?|path ?labs?|pathology|dental|dentist|practo|chemist|medical|medicos?|healthcare|thyrocare|lal path|metropolis|cult ?fit|cultfit|gym|fitness|physio)\b/i],
  ['home', /\b(rent|nobroker|nestaway|electricity|bescom|msedcl|mseb|tata power|adani electricity|bses|torrent power|tneb|cesc|power|airtel xstream|jio ?fiber|act fibernet|hathway|broadband|internet|indane|bharat gas|hp gas|mahanagar gas|igl|gail gas|piped gas|maintenance|society|apartment|mygate|water|urban company|urbanclap|ikea|pepperfry|home ?centre|homecenter|furniture|hardware|plumber|electrician|laundry)\b/i],
  ['personal', /\b(uber|ola|rapido|namma yatri|blusmart|metro|irctc|redbus|makemytrip|goibibo|cleartrip|ixigo|indigo|air india|akasa|vistara|spicejet|netflix|spotify|hotstar|jiohotstar|disney|prime video|youtube|google|apple ?com|itunes|icloud|audible|zee5|sonyliv|recharge|airtel|jio|vodafone|bsnl|salon|spa|barber|grooming|bookmyshow|pvr|inox|cinepolis|district|movies?|steam|playstation|claude|openai|chatgpt|anthropic)\b/i],
  ['shopping', /\b(amazon|amzn|flipkart|myntra|ajio|nykaa|meesho|tata cliq|tatacliq|croma|reliance digital|vijay sales|decathlon|lifestyle|westside|trends|zara|h&m|uniqlo|shoppers stop|pantaloons|max fashion|lenskart|snapdeal|firstcry|apple|samsung|boat|mall|fashion|apparel|footwear|bata|puma|nike|adidas)\b/i],
];

type CatRow = { id: number; name: string };

export function categoryIdByName(db: DB): Map<string, number> {
  const rows = db.prepare('SELECT id, name FROM categories').all() as CatRow[];
  return new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
}

/** Rules learned from your edits win, then the built-in keyword map. */
export function categorise(db: DB, merchantKey: string, haystack: string): CategoryMatch | null {
  const rule = db
    .prepare('SELECT category_id, display_name FROM merchant_rules WHERE merchant_key = ?')
    .get(merchantKey) as { category_id: number; display_name: string | null } | undefined;
  if (rule) return { categoryId: rule.category_id, by: 'rule', displayName: rule.display_name };

  const ids = categoryIdByName(db);
  for (const [name, re] of SEED) {
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

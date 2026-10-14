import { categoryIdByName } from '../classify/categorise.ts';
import type { DB } from '../db.ts';
import { categoriseWithLlm } from '../llm/ollama.ts';
import { itemKey, type ParsedItem } from './common.ts';

// Same prefix/word convention as the merchant seed map; order matters (vehicle before home: "air filter").
const ITEM_SEED: { category: string; prefix: string[]; word?: string[] }[] = [
  {
    category: 'vehicle',
    prefix: ['coolant', 'helmet', 'air filter', 'bmc', 'gasket', 'brake', 'chain lube', 'chain clean', 'engine oil', 'motul', 'castrol',
      'bike cover', 'car cover', 'tyre', 'tire', 'spark plug', 'motorcycle', 'motorbike', 'scooter', 'riding', 'dashcam', 'car charger',
      'car perfume', 'car wash', 'microfibre car', 'kawasaki', 'jupiter', 'ntorq', 'bike insurance', 'car insurance', 'fastag'],
    word: ['bike', 'car'],
  },
  {
    category: 'health',
    prefix: ['tablet', 'capsule', 'syrup', 'medicine', 'vitamin', 'multivitamin', 'supplement', 'whey', 'protein powder', 'omega',
      'paracetamol', 'dolo', 'crocin', 'bandage', 'band-aid', 'antiseptic', 'thermometer', 'oximeter', 'first aid', 'ointment', 'pain relief',
      'electral', 'ors', 'glucon', 'mask', 'sanitiser', 'sanitizer'],
  },
  // Home items whose names contain grocery words ("bottle" sits in Home, "fresh" in Groceries).
  { category: 'home', prefix: ['freshener', 'juicer', 'water bottle', 'oil dispenser', 'tea kettle', 'butter knife', 'milk pan', 'coffee mug', 'tea cup'] },
  {
    category: 'groceries',
    prefix: ['milk', 'curd', 'dahi', 'paneer', 'butter', 'cheese', 'ghee', 'bread', 'egg', 'atta', 'flour', 'maida', 'rice', 'dal',
      'toor', 'moong', 'chana', 'rajma', 'poha', 'oats', 'cereal', 'cornflakes', 'muesli', 'sugar', 'salt', 'jaggery', 'oil', 'masala',
      'spice', 'turmeric', 'haldi', 'chilli', 'pickle', 'sauce', 'ketchup', 'jam', 'honey', 'peanut butter', 'tea', 'coffee', 'biscuit',
      'cookie', 'chips', 'namkeen', 'snack', 'chocolate', 'noodle', 'maggi', 'pasta', 'juice', 'soda', 'cola', 'coke', 'pepsi', 'sprite',
      'mineral water', 'drinking water', 'coconut', 'fresh', 'onion', 'tomato', 'potato', 'garlic', 'ginger', 'gourd', 'doodhi', 'lauki', 'brinjal', 'okra', 'bhindi',
      'capsicum', 'carrot', 'cabbage', 'cauliflower', 'spinach', 'palak', 'coriander', 'mint', 'lemon', 'cucumber', 'beans', 'peas', 'mushroom',
      'banana', 'apple', 'mango', 'orange', 'grapes', 'papaya', 'watermelon', 'pomegranate', 'fruit', 'vegetable', 'chicken', 'mutton', 'fish',
      'prawn', 'protein bar', 'ritebite', 'yoghurt', 'yogurt', 'ice cream', 'frozen', 'amul', 'aashirvaad', 'tata sampann', 'fortune',
      'nandini', 'kinley', 'bisleri', 'haldiram', 'britannia', 'parle'],
  },
  {
    category: 'home',
    prefix: ['mop', 'broom', 'microfiber', 'microfibre', 'cleaning', 'cleaner', 'detergent', 'dishwash', 'dish wash', 'vim', 'harpic', 'lizol',
      'colin', 'scrub', 'sponge', 'duster', 'dustbin', 'garbage bag', 'trash bag', 'laundry', 'basket', 'storage', 'organiser', 'organizer',
      'stool', 'rack', 'shelf', 'hanger', 'tissue roll', 'tissue holder', 'bucket', 'mug', 'bedsheet', 'bed sheet', 'pillow', 'mattress',
      'curtain', 'doormat', 'rug', 'carpet', 'blanket', 'towel', 'kitchen', 'utensil', 'cookware', 'pressure cooker', 'cooker', 'kadai', 'tawa',
      'pan ', 'chopping', 'chop board', 'knife', 'container', 'bottle', 'flask', 'lunch box', 'juicer', 'mixer', 'grinder', 'blender',
      'kettle', 'toaster', 'induction', 'air fryer', 'iron', 'bulb', 'led ', 'tube light', 'extension board', 'switch', 'plug', 'fan',
      'air purifier', 'humidifier', 'water purifier', 'shoe washing', 'washing machine', 'distilled water', 'plant', 'planter', 'decor',
      'photo frame', 'wall clock', 'wall sticker', 'wall art', 'lamp', 'candle', 'philips hr', 'prestige', 'pigeon', 'milton', 'cello'],
  },
  {
    category: 'personal',
    prefix: ['shampoo', 'conditioner', 'soap', 'body wash', 'face wash', 'facewash', 'cream', 'lotion', 'moisturi', 'sunscreen', 'serum',
      'perfume', 'deo', 'deodorant', 'razor', 'trimmer', 'shaving', 'toothpaste', 'toothbrush', 'mouthwash', 'comb', 'hair', 'lip', 'nail',
      'makeup', 'kajal', 'sanitary', 'diaper', 'tshirt', 't-shirt', 'shirt', 'jeans', 'trouser', 'trackpant', 'track pant', 'shorts',
      'jacket', 'hoodie', 'sweatshirt', 'kurta', 'saree', 'dress', 'briefs', 'boxer', 'bra', 'innerwear', 'socks', 'shoe', 'sneaker',
      'slipper', 'sandal', 'flip flop', 'cap', 'wallet', 'belt', 'sunglass', 'book', 'novel', 'flower', 'bouquet', 'gift', 'ticket',
      'membership', 'subscription', 'gym'],
  },
  {
    category: 'shopping',
    prefix: ['tempered', 'screen protector', 'screen guard', 'case', 'cover', 'charger', 'adapter', 'cable', 'usb', 'type c', 'type-c',
      'earphone', 'earbuds', 'headphone', 'speaker', 'power bank', 'powerbank', 'smartwatch', 'watch', 'mouse', 'keyboard', 'laptop',
      'monitor', 'phone', 'mobile', 'tablet stand', 'stand', 'tripod', 'memory card', 'pendrive', 'ssd', 'hdd', 'router', 'portronics',
      'boat', 'oneplus', 'samsung', 'oppo', 'apple', 'iphone', 'battery', 'toy', 'stationery', 'pen', 'notebook', 'bag', 'backpack'],
  },
];

const term = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
const ITEM_SEED_RES: [string, RegExp][] = ITEM_SEED.map(({ category, prefix, word = [] }) => [
  category,
  new RegExp(`\\b(?:${prefix.map(term).join('|')})${word.length ? `|\\b(?:${word.map(term).join('|')})\\b` : ''}`, 'i'),
]);

export interface ItemCategory {
  categoryId: number | null;
  by: 'parser' | 'user' | 'llm' | 'seed' | 'order' | null;
}

/** Your corrections first, then the parser's own hint, the keyword map, and (cached) the local model. */
export async function categoriseItem(db: DB, item: ParsedItem, opts: { useLlm: boolean; orderKind?: string }): Promise<ItemCategory> {
  const ids = categoryIdByName(db);
  const key = itemKey(item.name);
  const rule = db.prepare('SELECT category_id, source FROM item_rules WHERE item_key = ?').get(key) as { category_id: number; source: 'user' | 'llm' } | undefined;
  if (rule?.source === 'user') return { categoryId: rule.category_id, by: 'user' };
  if (item.category && ids.get(item.category)) return { categoryId: ids.get(item.category)!, by: 'parser' };
  if (opts.orderKind === 'food') return { categoryId: ids.get('food') ?? null, by: 'order' };
  for (const [name, re] of ITEM_SEED_RES) if (re.test(item.name) && ids.get(name)) return { categoryId: ids.get(name)!, by: 'seed' };
  if (rule) return { categoryId: rule.category_id, by: 'llm' };

  if (opts.useLlm) {
    const name = await categoriseWithLlm(item.name, `A product bought online: ${item.name}`, [...ids.keys()]);
    const id = name ? ids.get(name) : undefined;
    if (id) {
      db.prepare(
        `INSERT INTO item_rules (item_key, category_id, source) VALUES (?, ?, 'llm')
         ON CONFLICT(item_key) DO NOTHING`,
      ).run(key, id);
      return { categoryId: id, by: 'llm' };
    }
  }
  return { categoryId: null, by: null };
}

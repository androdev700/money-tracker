import { describe, expect, it } from 'vitest';
import { openDb } from '../../server/db.ts';
import { categoriseItem } from '../../server/orders/categorise-item.ts';

const db = openDb(':memory:');
const name = (id: number | null) => (id === null ? null : (db.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string }).name);
const cat = async (item: string, orderKind?: string) => name((await categoriseItem(db, { name: item, qty: 1, pricePaise: null }, { useLlm: false, orderKind })).categoryId);

describe('item categories', () => {
  it.each([
    ['ShineXPro Microfiber Cleaning Clo...', 'home'],
    ['NutriPro Juicer Mixer Grinder - S...', 'home'],
    ['Philips HR1863/20 Centrifugal Juicer', 'home'],
    ['PANCA Shoe Washing Machine...', 'home'],
    ['Bepure Distilled Water 5L...', 'home'],
    ['Wooden Storage Stool with...', 'home'],
    ['ELIZA KRAFTS Laundry Basket for C...', 'home'],
    ['WOOD ART STORE Metal Black Tissue Roll...', 'home'],
    ['Vivela Extendable Ceiling Broom with...', 'home'],
    ['Hawkins 1.5 Litre Contura Black Pressure Cooker', 'home'],
    ['Godrej aer Room Freshener', 'home'],
    ['Milton Water Bottle 1L', 'home'],
    ['BMC Air Filter WA16-01', 'vehicle'],
    ['Kawasaki Gasket 50.8X62X30 11061-0447', 'vehicle'],
    ['Liqui Moly Ready Mix Radiator Coolant RAF12+ (1 Litre)', 'vehicle'],
    ['STP FEEL® Premium HD+ Tempered Gl...', 'shopping'],
    ['Samsung S23 Back Cover - Ultimate Thin Case', 'shopping'],
    ['OPPO SUPERVOOC 100W Dual Ports Power Adapter White', 'shopping'],
    ['Ritebite Max Protein Daily Choco ...', 'groceries'],
    ['Kinley Strong Soda Original, 750 Ml', 'groceries'],
    ['Fresh Bottle Gourd (Doodhi) - 1 Piece', 'groceries'],
    ['Coke Zero Zero Cola Sugar, No Calories Soft Drink', 'groceries'],
    ['Amul Taaza Toned Milk 500ml', 'groceries'],
    ['Dermafique Hydra Soft Nourishing Body Wash 500ml', 'personal'],
    ['The Flora Single Sunflower Bouquet', 'personal'],
    ['Men Gym Trackpant Convertible, Jog Fit', 'personal'],
    ['Leather Wallet for Men', 'personal'],
    ['Prestige Omega Deluxe Granite Fla...', 'home'],
    ['ARISTO Lock & Fresh 222 Plastic S...', 'home'],
    ['Shri Samriddhi Enterprises Mango Wood', 'home'],
    ['Gluman Stainless Steel Mixing Bow...', 'home'],
    ['KiKiluxxa Glass Straws with Clean...', 'home'],
    ['HOKIPO Chenille Sofa Couch Slipco...', 'home'],
    ['Liqui Moly Ready Mix Radiator Coo...', 'vehicle'],
    ['Wavex Alubright Pro Aluminium Cle...', 'vehicle'],
    ['Loctite Threadlocker Blue 242 loc...', 'vehicle'],
    ['Wella Professionals Fusion Intens...', 'personal'],
    ['PRITO Nilkin® Slim Magnetic Matte...', 'shopping'],
    ['SIDRUM J Hook Buckle Mount for Go...', 'shopping'],
    ['Themisto TH-M61 Digital Vernier C...', 'shopping'],
    ['nectr Iceberg Lettuce', 'groceries'],
    ['Generic Anti Fungal Dusting Powder...', 'health'],
  ])('%s → %s', async (item, expected) => {
    expect(await cat(item)).toBe(expected);
  });

  it('food orders are food whatever the dish is called', async () => {
    expect(await cat('Paneer Butter Masala', 'food')).toBe('food');
  });

  it('your correction beats the keyword map', async () => {
    const home = (db.prepare(`SELECT id FROM categories WHERE name = 'home'`).get() as { id: number }).id;
    db.prepare(`INSERT INTO item_rules (item_key, category_id, source) VALUES ('ritebitemaxproteindailychoco', ?, 'user')`).run(home);
    expect(await cat('Ritebite Max Protein Daily Choco ...')).toBe('home');
  });

  it('leaves unknown items uncategorised without the model', async () => {
    expect(await cat('THE ATOMIC HABITS')).toBeNull();
  });
});

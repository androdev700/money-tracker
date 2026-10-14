import { describe, expect, it } from 'vitest';
import { itemKey, itemTitle, mealName, superscriptPaise } from '../../server/orders/common.ts';
import { parseOrderEmail } from '../../server/orders/parse.ts';
import * as f from '../fixtures/orders.ts';

const order = (email: Parameters<typeof parseOrderEmail>[0]) => {
  const r = parseOrderEmail(email);
  if (r.status !== 'order') throw new Error(`expected an order, got ${r.status}: ${'reason' in r ? r.reason : ''}`);
  return r.order;
};

describe('order parsers', () => {
  it('Swiggy food: restaurant, order time, items, amount paid', () => {
    expect(order(f.swiggyFood)).toEqual({
      source: 'swiggy',
      store: 'Green Bowl Kitchen',
      orderRef: '250600000000001',
      orderedAt: '2026-10-11T17:00:00',
      totalPaise: 34400,
      kind: 'food',
      items: [
        { name: 'Paneer Butter Masala', qty: 1, pricePaise: 29700 },
        { name: 'Butter Naan', qty: 2, pricePaise: 9000 },
      ],
    });
  });

  it('Swiggy single item at lunch', () => {
    expect(order(f.swiggySingle)).toMatchObject({ orderedAt: '2026-10-12T13:02:00', totalPaise: 25400, items: [{ name: 'Sabudana Khichdi with Dahi', qty: 1 }] });
  });

  it('Instamart: grocery items with prices and grand total', () => {
    expect(order(f.instamart)).toMatchObject({
      source: 'swiggy',
      store: 'Instamart',
      kind: 'grocery',
      totalPaise: 39700,
      items: [
        { name: 'Amul Taaza Toned Milk 500ml', qty: 2, pricePaise: 2900 },
        { name: 'Fresh Tomato 500g', qty: 1, pricePaise: 3800 },
        { name: 'Aashirvaad Atta 5kg', qty: 1, pricePaise: 28900 },
      ],
    });
  });

  it('Zomato: restaurant from subject, items without prices, order time before delivery', () => {
    expect(order(f.zomato)).toMatchObject({
      store: 'Sample Biryani House',
      orderRef: '8500000001',
      orderedAt: '2026-08-26T20:05:00',
      totalPaise: 35257,
      items: [
        { name: 'Rumali Roti', qty: 1, pricePaise: null },
        { name: 'BBQ Chicken Seekh Kebab', qty: 2, pricePaise: null },
      ],
    });
  });

  it('Amazon: superscript item prices, charged total, order number', () => {
    expect(order(f.amazonSingle)).toMatchObject({ orderRef: '406-0000000-0000001', totalPaise: 43522, items: [{ name: 'Prestige Microfiber Spin Mop wi...', qty: 1, pricePaise: 43900 }] });
    expect(order(f.amazonMulti).items).toEqual([
      { name: 'Kinley Soda Original 750 ml...', qty: 2, pricePaise: 4000 },
      { name: 'Fresh Bottle Gourd (Doodhi) -...', qty: 1, pricePaise: 3900 },
      { name: 'Amul Butter Pasteurised 100 g...', qty: 1, pricePaise: 6200 },
    ]);
  });

  it('Flipkart, Decathlon and BookMyShow', () => {
    expect(order(f.flipkart)).toMatchObject({ orderRef: 'OD400000000000000100', totalPaise: 31700, items: [{ name: 'THE ATOMIC HABITS', qty: 1 }] });
    expect(order(f.decathlon)).toMatchObject({ orderRef: '2600000001', totalPaise: 104800, items: [{ name: 'Men Gym Trackpant Convertible, Jog Fit, Quick Dry, Zip Pockets, 500 - Black', qty: 1, pricePaise: 99900 }] });
    expect(order(f.bookmyshow)).toMatchObject({ orderRef: 'WRPJ000', orderedAt: '2026-10-02T14:18:00', totalPaise: 48806, items: [{ name: 'Sample Movie The Conclusion', qty: 2, category: 'personal' }] });
  });

  it.each([
    ['Swiggy Dineout reminder', f.swiggyDineout],
    ['Zomato Gold renewal', f.zomatoGold],
    ['Amazon shipping update', f.amazonShipped],
  ])('ignores %s', (_, email) => {
    expect(parseOrderEmail(email).status).toBe('ignored');
  });

  it('sends unknown senders to the model only when they look like a purchase', () => {
    expect(parseOrderEmail({ from: 'x@spotify.com', subject: 'Your order confirmation for "Premium"', receivedAt: '2026-08-06T14:47:00', body: 'Item Premium ₹119.00' }).status).toBe('unparsed');
    expect(parseOrderEmail({ from: 'x@shop.com', subject: 'Your order has been shipped', receivedAt: '2026-08-06T14:47:00', body: 'Total ₹119.00' }).status).toBe('ignored');
  });
});

describe('order helpers', () => {
  it.each([
    ['2026-10-11T04:59:00', 'Late-night'],
    ['2026-10-11T05:00:00', 'Breakfast'],
    ['2026-10-11T10:59:00', 'Breakfast'],
    ['2026-10-11T11:00:00', 'Lunch'],
    ['2026-10-11T16:00:00', 'Snacks'],
    ['2026-10-11T19:00:00', 'Dinner'],
    ['2026-10-11T23:00:00', 'Late-night'],
    ['2026-10-11T00:30:00', 'Late-night'],
  ])('meal at %s is %s', (at, meal) => expect(mealName(at)).toBe(meal));

  it('reads Amazon superscript prices and tidies names', () => {
    expect(superscriptPaise('1,70400')).toBe(170400);
    expect(itemTitle('THE ATOMIC HABITS')).toBe('The Atomic Habits');
    expect(itemTitle('Prestige Microfiber Spin Mop wi...')).toBe('Prestige Microfiber Spin Mop wi');
    expect(itemKey('Prestige Microfiber Spin Mop wi...')).toBe(itemKey('PRESTIGE microfiber spin mop wi'));
  });
});

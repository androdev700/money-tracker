// Order emails in the exact layout each merchant sends (as extracted to text), with invented
// items, amounts, ids, names and addresses.
import type { OrderEmail } from '../../server/orders/common.ts';

const PAD = '͏ ­'.repeat(40);

export const swiggyFood: OrderEmail = {
  from: 'Swiggy <noreply@swiggy.in>',
  subject: 'Your Swiggy order was delivered superfast',
  receivedAt: '2026-10-11T17:17:00',
  body: 'Delivery in 16 mins! ₹171 saved on this order ₹130 saved with SAVE4FOOD coupon ₹41 saved with Swiggy ORDER JOURNEY Green Bowl Kitchen Counter 3, No. 114, 1st C Main, Sample Layout, 7th Block, Koramangala, Bengaluru, Karnataka 560095 Oct 11, 5:00 PM A Customer Ground, 80 Feet Road, Sample Garden, Bengaluru, Karnataka, India, Bangalore Oct 11, 5:17 PM Order ID: 250600000000001 BILL DETAILS Paneer Butter Masala x1 ₹297 Butter Naan x2 ₹90 Restaurant Packaging ₹35 Platform fee with GST ₹17.98 Discount Applied (SAVE4FOOD) - ₹130 Delivery Fee (FREE with Swiggy One) | 1.9 kms FREE Express Fee ₹19 Taxes ₹14.82 Paid Via Credit/Debit card ₹344 Disclaimer: Attached is the invoice for the restaurant services provided by the outlet. Get the Swiggy App: Follow us here:',
};

export const swiggySingle: OrderEmail = {
  ...swiggyFood,
  subject: 'Your Swiggy order was delivered on time',
  receivedAt: '2026-10-12T13:20:00',
  body: swiggyFood.body
    .replace('Oct 11, 5:00 PM', 'Oct 12, 1:02 PM')
    .replace('Order ID: 250600000000001', 'Order ID: 250600000000002')
    .replace('Paneer Butter Masala x1 ₹297 Butter Naan x2 ₹90', 'Sabudana Khichdi with Dahi x1 ₹297')
    .replace('₹344', '₹254'),
};

export const swiggyDineout: OrderEmail = {
  from: 'Swiggy <noreply@swiggy.in>',
  subject: '⏰ Final Call! Save by Paying with Swiggy Dineout Today!',
  receivedAt: '2026-10-12T13:08:00',
  body: 'A Customer, ready for your bill payment? Booking ID: 250670800000000 Monday12-Oct-2026 Lunch12:45 PM For 7 guests Sample Lounge Koramangala, Bangalore Offers on paying via Swiggy Flat 10% off on total bill',
};

export const instamart: OrderEmail = {
  from: 'Instamart <noreply@instamart.in>',
  subject: 'Your Instamart order was successfully delivered',
  receivedAt: '2026-10-04T19:32:00',
  body: 'Greetings from Instamart👋 Your Instamart order id: 250091100000000 was successfully delivered. Deliver To: A Customer Sample Main Road, HSR Layout, Bengaluru, Karnataka, India Order Items 2 x Amul Taaza Toned Milk 500ml ₹29.00 1 x Fresh Tomato 500g ₹38.00 1 x Aashirvaad Atta 5kg ₹289.00 Order Summary Item Bill ₹385.00 Handling Fee ₹12.00 Delivery Partner Fee ₹0.00 Grand Total ₹397.00 Get the App: Follow us: ©Swiggy Instamart Private Limited. All rights reserved.',
};

export const zomato: OrderEmail = {
  from: 'Zomato <noreply@zomato.com>',
  subject: 'Your Zomato order from Sample Biryani House',
  receivedAt: '2026-08-26T20:27:00',
  body: 'Zoooooooooooop! That was quick. Hi A Customer, Your order from Sample Biryani House was delivered in just 22 minutes. ORDER ID: 8500000001 Delivered Sample Biryani House 36/23G, Survey 36/23G, Begur Hobli, Sample Nagar, Bangalore 1 X Rumali Roti 2 X BBQ Chicken Seekh Kebab Total paid - ₹352.57 Eternal employees or representatives will NEVER ask you for your personal information. ©2026 - Zomato, All rights reserved.',
};

export const zomatoGold: OrderEmail = {
  from: 'Zomato <noreply@zomato.com>',
  subject: 'Your Zomato Gold has been renewed successfully for 3 months! 👑',
  receivedAt: '2026-09-01T10:00:00',
  body: 'Your Gold membership is renewed. Amount paid ₹30.',
};

export const amazonSingle: OrderEmail = {
  from: 'Amazon.in <auto-confirm@amazon.in>',
  subject: 'Ordered: "Prestige Microfiber Mop..."',
  receivedAt: '2026-10-12T18:32:00',
  body: `Ordered: "Prestige Microfiber Mop..."${PAD} Your Orders Your Account Buy Again THANKS FOR YOUR ORDER! Ordered Shipped Out for delivery Delivered Arriving tomorrow 8 am – 12 pm A Customer – BENGALURU, KARNATAKA Order # ‫406-0000000-0000001 View or edit order Prestige Microfiber Spin Mop wi... Quantity: 1 ₹43900 Total ₹435.22 ©2026 Amazon.com, Inc. or its affiliates. All rights reserved. Privacy Policy`,
};

export const amazonMulti: OrderEmail = {
  from: 'Amazon.in <auto-confirm@amazon.in>',
  subject: 'Ordered: "Kinley Soda Original 750..." and 2 more items',
  receivedAt: '2026-08-29T11:05:00',
  body: `Ordered: "Kinley Soda Original 750..." and 2 more items${PAD} Your Orders Your Account Buy Again THANKS FOR YOUR ORDER! Ordered Shipped Out for delivery Delivered Arriving today A Customer – BENGALURU, KARNATAKA Order # ‫171-0000000-0000002 View or edit order Kinley Soda Original 750 ml... Quantity: 2 ₹4000 Fresh Bottle Gourd (Doodhi) -... Quantity: 1 ₹3900 Amul Butter Pasteurised 100 g... Quantity: 1 ₹6200 Total ₹181.00 ©2026 Amazon.com, Inc. or its affiliates. All rights reserved. Privacy Policy`,
};

export const amazonShipped: OrderEmail = {
  from: 'Amazon.in <shipment-tracking@amazon.in>',
  subject: 'Shipped: “Prestige Microfiber Mop...”',
  receivedAt: '2026-10-13T09:00:00',
  body: `Shipped${PAD} Order # ‫406-0000000-0000001 Track package Prestige Microfiber Spin Mop wi... Quantity: 1`,
};

export const flipkart: OrderEmail = {
  from: 'Flipkart <noreply@rmt.flipkart.com>',
  subject: 'Your Order for THE ATOMIC HABITS ... has been successfully placed',
  receivedAt: '2026-08-01T05:28:00',
  body: "Order Placed Hi A Customer, Your order has been successfully placed. Order placed on Aug 01, 2026 Order ID OD400000000000000100 We are committed to serving you with utmost regard for your safety. Delivery by Thu, Aug 06, 2026 Amount Paid₨. 317 Manage Your Order Delivery Address A Customer Sample Road, Bengaluru, Karnataka, 560100 SMS updates sent to9000000000 You will receive the next update when the item in your order is packed/shipped by the seller. THE ATOMIC HABITS Delivery by Thu, Aug 06, 2026 Seller: Sample Books Shipping fee Rs. 45 Qty: 1 Amount Paid ₨. 317 Thank you for shopping with Flipkart!",
};

export const decathlon: OrderEmail = {
  from: 'Decathlon <noreply-decathlonindia@decathlon.com>',
  subject: 'Your Decathlon Order 2600000001 is Delivered',
  receivedAt: '2026-05-30T10:41:00',
  body: 'Hurray!! Your order is Delivered Hello A Customer, Thank you for making us a part of your sports journey. Address details Delivery address Sample Wing, Bengaluru KARNATAKA, 560100 Order details Men Gym Trackpant Convertible, Jog Fit, Quick Dry, Zip Pockets, 500 - Black Qty:1 ₹999 Order value (1 items) ₹999 Overall Discount - ₹0 Convenience fee ₹49 Total ₹1,048 Download the Decathlon App to explore more...',
};

export const bookmyshow: OrderEmail = {
  from: 'BookMyShow <tickets@bookmyshow.com>',
  subject: 'Your Tickets',
  receivedAt: '2026-10-02T14:20:00',
  body: 'Your booking is confirmed! Booking ID WRPJ000 Sample Movie The Conclusion (UA16+) 09:30am | Sat, 3 Oct, 2026 Cinepolis: Sample Mall, Bengaluru(SCREEN 06) PREMIUM - H12, H13 SCREEN 06 ORDER SUMMARY TICKET AMOUNT Quantity Rs.700.00 2 tickets Convenience fees Rs.115.64 DISCOUNT Rs.350.00 AMOUNT PAID Rs.488.06 Booking Date & Time Fri, 2 Oct, 2026 | 02:18pm Payment Type Credit Card/Debit Card Confirmation# 2400000',
};

export const decathlonConfirmed: OrderEmail = {
  from: 'Decathlon <noreply-decathlonindia@decathlon.com>',
  subject: 'Your Decathlon Order 28600001 is Confirmed',
  receivedAt: '2026-05-28T23:12:00',
  body: 'Thank you for your order! Hello A Customer, Order details Package ID : 28600001 Delivery Date : 30th May, 2026 Men Gym Trackpant Convertible, Jog Fit, Quick Dry, Zip Pockets, 500 - Black Qty:1 ₹999 Order value (1 items) ₹999 Overall Discount - ₹0 Convenience fee ₹49 Total ₹1,048',
};

export const amazonCancelled: OrderEmail = {
  from: 'Amazon.in <payments-update@amazon.in>',
  subject: 'Item cancelled: "Prestige Microfiber Mop..."',
  receivedAt: '2026-10-13T04:28:00',
  body: `Item cancelled${PAD} YOUR ITEMS WERE CANCELLED Cancelled If you were charged, a refund will be processed. Order # ‫406-0000000-0000001 View order details Prestige Microfiber Spin Mop wi... Quantity: 1 ₹43900`,
};

export const razorpayInOrders: OrderEmail = {
  from: 'Razorpay <no-reply@razorpay.com>',
  subject: 'Payment successful for SomeShop',
  receivedAt: '2026-06-08T19:35:00',
  body: 'SomeShop ₹1,700.00 Paid Successfully Payment Id pay_ABC Method card XXXX-XXXX-XXXX-0001 Paid On 08 Jun, 2026 07:35:17 PM IST',
};

export const broadbandBill: OrderEmail = {
  from: 'ACT <no-reply@mailer22.actcorp.in>',
  subject: 'ACT Fibernet Invoice for September 2026',
  receivedAt: '2026-09-01T20:54:00',
  body: 'Your Monthly ACT Fibernet bill has been generated. Pay before due date to avoid interruption AMOUNT DUE BILL DATE ₹ 1180.00 SEPTEMBER 01, 2026 DUE: SEPTEMBER 23, 2026 PAY NOW',
};

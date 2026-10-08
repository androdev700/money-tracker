// Representative bank alert emails, reconstructed from the formats each bank sends.
// Replace or extend with real samples (anonymised) as `npm run parse-report` surfaces misses.

export interface Fixture {
  name: string;
  from: string;
  subject: string;
  body: string;
  receivedAt?: string;
  expect:
    | { status: 'ignored' | 'unparsed' }
    | {
        status: 'parsed';
        direction: 'debit' | 'credit';
        refund?: boolean;
        amountPaise: number;
        merchant: string;
        last4: string | null;
        instrument: 'UPI' | 'CC' | 'DC' | 'ACCOUNT';
        txnAt: string;
        refNo?: string | null;
        kind: 'spend' | 'refund' | 'excluded' | null;
        category?: string | null;
      };
}

const RECEIVED = '2026-10-05T14:25:00';

export const fixtures: Fixture[] = [
  {
    name: 'HDFC UPI debit',
    from: 'HDFC Bank InstaAlerts <alerts@hdfcbank.net>',
    subject: '❗ You have done a UPI txn. Check details!',
    body: 'Dear Customer, Rs.450.00 has been debited from account **4321 to VPA swiggy.stores@axb SWIGGY on 05-10-26. Your UPI transaction reference number is 627812345678. If you did not authorize this transaction, please report it immediately by calling 18002586161 Or SMS BLOCK UPI to 7308080808. Warm Regards, HDFC Bank',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 45000, merchant: 'Swiggy', last4: '4321', instrument: 'UPI', txnAt: '2026-10-05T14:25:00', refNo: '627812345678', kind: 'spend', category: 'food' },
  },
  {
    name: 'HDFC credit card swipe (classic)',
    from: 'HDFC Bank InstaAlerts <alerts@hdfcbank.net>',
    subject: 'Alert : Update on your HDFC Bank Credit Card',
    body: 'Dear Card Member, Thank you for using your HDFC Bank Credit Card ending 1234 for Rs 1,250.00 at AMAZON PAY INDIA PRIVA on 05-10-2026 14:22:11. Authorization code:- 123456 After the above transaction, the available balance on your card is Rs 85,000.00 and the total outstanding is Rs 15,000.00.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 125000, merchant: 'Amazon Pay', last4: '1234', instrument: 'CC', txnAt: '2026-10-05T14:22:11', refNo: null, kind: 'spend', category: 'shopping' },
  },
  {
    name: 'HDFC credit card debit (new format)',
    from: 'HDFC Bank InstaAlerts <alerts@hdfcbank.bank.in>',
    subject: 'Rs.1250.00 debited via Credit Card **1234',
    body: 'Dear Customer, Rs.1250.00 is debited from your HDFC Bank Credit Card ending 1234 towards DMART AVENUE SUPERMARTS on 05 Oct, 2026 at 14:22:11. If you did not authorize this transaction, please call on 18002586161.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 125000, merchant: 'Dmart Avenue Supermarts', last4: '1234', instrument: 'CC', txnAt: '2026-10-05T14:22:11', kind: 'spend', category: 'groceries' },
  },
  {
    name: 'HDFC debit card at a petrol pump',
    from: 'alerts@hdfcbank.net',
    subject: 'Alert : Update on your HDFC Bank Debit Card',
    body: 'Dear Customer, Thank you for using your HDFC Bank Debit Card ending 5678 for Rs 2,000.00 at HP PAY PETROL PUMP on 06-10-2026 09:10:00.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 200000, merchant: 'Hp Pay Petrol Pump', last4: '5678', instrument: 'DC', txnAt: '2026-10-06T09:10:00', kind: 'spend', category: 'fuel' },
  },
  {
    name: 'HDFC UPI money received is not spend',
    from: 'alerts@hdfcbank.net',
    subject: 'You have received money',
    body: 'Dear Customer, Rs.10000.00 has been credited to your account **4321 by VPA friend@okaxis FRIEND NAME on 07-10-26. Your UPI transaction reference number is 628012340000.',
    expect: { status: 'parsed', direction: 'credit', amountPaise: 1000000, merchant: 'Friend', last4: '4321', instrument: 'UPI', txnAt: '2026-10-07T12:00:00', kind: null },
  },
  {
    name: 'HDFC credit card refund',
    from: 'alerts@hdfcbank.net',
    subject: 'Refund credited to your HDFC Bank Credit Card',
    body: 'Dear Customer, Rs.599.00 has been credited to your HDFC Bank Credit Card ending 1234 towards refund from MYNTRA DESIGNS PVT LTD on 08-10-2026.',
    expect: { status: 'parsed', direction: 'credit', refund: true, amountPaise: 59900, merchant: 'Myntra Designs', last4: '1234', instrument: 'CC', txnAt: '2026-10-08T12:00:00', kind: 'refund', category: 'shopping' },
  },
  {
    name: 'HDFC UPI to CRED is a card bill payment',
    from: 'alerts@hdfcbank.net',
    subject: 'You have done a UPI txn',
    body: 'Dear Customer, Rs.15000.00 has been debited from account **4321 to VPA cred.club@axisb CRED Club on 09-10-26. Your UPI transaction reference number is 628212345678.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 1500000, merchant: 'Cred Club', last4: '4321', instrument: 'UPI', txnAt: '2026-10-09T12:00:00', kind: 'excluded' },
  },
  {
    name: 'HDFC credit card payment received is ignored',
    from: 'alerts@hdfcbank.net',
    subject: 'Payment received on your credit card',
    body: 'Dear Card Member, Payment of Rs. 15,000.00 has been received towards your HDFC Bank Credit Card ending 1234 on 09-10-2026. Thank you.',
    expect: { status: 'parsed', direction: 'credit', amountPaise: 1500000, merchant: 'Your Hdfc Bank Credit Card Ending', last4: '1234', instrument: 'CC', txnAt: '2026-10-09T12:00:00', kind: null },
  },
  {
    name: 'ICICI credit card',
    from: 'ICICI Bank <credit_cards@icicibank.com>',
    subject: 'Transaction alert for your ICICI Bank Credit Card',
    body: 'Dear Customer, Your ICICI Bank Credit Card XX9876 has been used for a transaction of INR 349.00 on Oct 05, 2026 at 20:15:42. Info: ZOMATO LTD. The Available Credit Limit on your card is INR 1,20,000.00 and Total Credit Limit is INR 2,00,000.00.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 34900, merchant: 'Zomato', last4: '9876', instrument: 'CC', txnAt: '2026-10-05T20:15:42', kind: 'spend', category: 'food' },
  },
  {
    name: 'ICICI account UPI debit',
    from: 'alerts@icicibank.com',
    subject: 'Transaction alert for your ICICI Bank Account',
    body: 'Dear Customer, ICICI Bank Account XX123 has been debited with INR 220.00 on 06-Oct-26. Info: UPI/628012345678/BLINKIT COMMERCE PRIVATE LIMITED. The Available Balance is INR 50,000.00.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 22000, merchant: 'Blinkit Commerce', last4: '123', instrument: 'UPI', txnAt: '2026-10-06T12:00:00', refNo: '628012345678', kind: 'spend', category: 'groceries' },
  },
  {
    name: 'Axis credit card (sentence)',
    from: 'Axis Bank Alerts <alerts@axisbank.com>',
    subject: 'Transaction alert on Axis Bank Credit Card no. XX4455',
    body: 'Transaction alert on Axis Bank Credit Card no. XX4455 INR 1,800 spent on 07-10-2026 21:05:33 IST at THE BEER CAFE. Available Limit: INR 45,000.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 180000, merchant: 'The Beer Cafe', last4: '4455', instrument: 'CC', txnAt: '2026-10-07T21:05:33', kind: 'spend', category: 'drinks' },
  },
  {
    name: 'Axis credit card (table)',
    from: 'alerts@axisbank.com',
    subject: 'Transaction alert on Axis Bank Credit Card',
    body: 'Transaction Amount: INR 650 Merchant Name: UBER INDIA SYSTEMS Axis Bank Credit Card No. XX4455 Date & Time: 07-10-2026, 22:40:10 IST Available Limit*: INR 44,350',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 65000, merchant: 'Uber Systems', last4: '4455', instrument: 'CC', txnAt: '2026-10-07T22:40:10', kind: 'spend', category: 'personal' },
  },
  {
    name: 'Axis account UPI debit',
    from: 'alerts@axisbank.com',
    subject: 'Debit alert',
    body: 'Dear Customer, INR 500.00 has been debited from A/c no. XX7788 on 07-10-2026 13:00:01 IST at UPI/P2M/628112345678/ZEPTO MARKETPLACE PRIVATE LIMITED. Available balance: INR 12,000.00.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 50000, merchant: 'Zepto Marketplace', last4: '7788', instrument: 'UPI', txnAt: '2026-10-07T13:00:01', refNo: '628112345678', kind: 'spend', category: 'groceries' },
  },
  {
    name: 'SBI Card spend',
    from: 'SBI Card <onlinesbicard@sbicard.com>',
    subject: 'Transaction Alert from SBI Card',
    body: 'Dear Cardholder, Rs.2,345.00 spent on your SBI Credit Card ending 3344 at APOLLO PHARMACY on 08/10/26. Trxn. not done by you? Report at https://sbicard.com/Dispute',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 234500, merchant: 'Apollo Pharmacy', last4: '3344', instrument: 'CC', txnAt: '2026-10-08T12:00:00', kind: 'spend', category: 'health' },
  },
  {
    name: 'SBI UPI debit without currency marker',
    from: 'cbssbi.cas@alerts.sbi.co.in',
    subject: 'Alert from SBI',
    body: 'Dear UPI user A/C X6655 debited by 120.0 on date 08Oct26 trf to INDIAN OIL Refno 628312345678. If not u? call 1800111109. -SBI',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 12000, merchant: 'Indian Oil', last4: '6655', instrument: 'UPI', txnAt: '2026-10-08T12:00:00', refNo: '628312345678', kind: 'spend', category: 'fuel' },
  },
  {
    name: 'Kotak UPI sent',
    from: 'BankAlerts@kotak.com',
    subject: 'Kotak Bank: Money sent',
    body: 'Sent Rs.300.00 from Kotak Bank AC X2211 to rapido.bike@ybl on 09-10-26.UPI Ref 628412345678. Not you, https://kotak.com/KBANKT/Fraud',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 30000, merchant: 'Rapido Bike', last4: '2211', instrument: 'UPI', txnAt: '2026-10-09T12:00:00', refNo: '628412345678', kind: 'spend', category: 'personal' },
  },
  {
    name: 'Kotak credit card',
    from: 'creditcardalerts@kotak.com',
    subject: 'Transaction alert',
    body: 'A Transaction of INR 1,250.00 has been made on your Kotak Bank Credit Card No.XX8899 at DECATHLON SPORTS INDIA on 10/10/2026.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 125000, merchant: 'Decathlon Sports', last4: '8899', instrument: 'CC', txnAt: '2026-10-10T12:00:00', kind: 'spend', category: 'shopping' },
  },
  {
    name: 'Amazon Pay balance payment',
    from: 'no-reply@amazonpay.in',
    subject: 'Rs 197.00 was paid on Amazon.in',
    body: 'Hi Customer, Thanks for using Amazon Pay Balance. Your payment was successful.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 19700, merchant: 'Amazon', last4: null, instrument: 'WALLET', txnAt: RECEIVED, kind: 'spend', category: 'shopping' },
  },
  {
    name: 'Amazon Pay payment to another merchant (12-hour clock quirk)',
    from: 'no-reply@amazonpay.in',
    subject: 'Your payment of ₹ 338.0 to Zepto  was successful',
    body: 'Hi Customer, Your payment to Zepto is Approved. Amount: ₹338.0 Payment date: Thursday, 10 September, 2026 13:19:45 PM IST Terms and Conditions: https://www.amazon.in/b?node=1 This email was sent from an email address that can\'t receive emails.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 33800, merchant: 'Zepto', last4: null, instrument: 'ACCOUNT', txnAt: '2026-09-10T13:19:45', kind: 'spend', category: 'groceries' },
  },
  {
    name: 'Amazon Pay cashback is ignored',
    from: 'no-reply@amazonpay.in',
    subject: 'Your cashback of ₹200.00 is here!',
    body: 'Hi Customer, <b>Yay! Here’s ₹200.00 cashback!</b><br>You’ve got this cashback for <a href="https://www.amazon.in/gp/css/order-history">Pressure Cooker</a>. Sometimes your cashback could get credited in parts.',
    expect: { status: 'ignored' },
  },
  {
    name: 'Amazon Pay reminder is ignored',
    from: 'no-reply@amazonpay.in',
    subject: 'Payment Reminder',
    body: 'Dear Customer, your bill of ₹1,499.00 is due.',
    expect: { status: 'ignored' },
  },
  {
    name: 'PayU order receipt',
    from: 'payment-report@payu.in',
    subject: 'Your Order at ACME PARTS PRIVATE LIMITED is successful',
    body: 'PayU Transaction ID: 10000001 Rs. 6100.00 Paid to ACME PARTS PRIVATE LIMITED via creditcard on 26 Aug 2026 12:57 PM Here are your transaction details: PayU ID 30000000001 Bank Reference Number 1234567890123456789012 For any product/service query, please contact the merchant.',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 610000, merchant: 'Acme Parts', last4: null, instrument: 'CC', txnAt: '2026-08-26T12:57:00', refNo: '1234567890123456', kind: 'spend' },
  },
  {
    name: 'PayU payment link receipt',
    from: 'noreply@payu.in',
    subject: 'INR 6100.0 paid via payment Link to ACME PARTS PRIVATE LIMITED',
    body: 'INR 6100.0 Paid to ACME PARTS PRIVATE LIMITED on 2026-08-26 12:56:28 via payment Link. Here are your transaction details: Transaction Id 30000000001 Bank Reference Number 1234567890123456789012',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 610000, merchant: 'Acme Parts', last4: null, instrument: 'ACCOUNT', txnAt: '2026-08-26T12:56:28', refNo: '1234567890123456', kind: 'spend' },
  },
  {
    name: 'Razorpay card receipt (afternoon time)',
    from: 'no-reply@razorpay.com',
    subject: 'Payment successful for MotoGear',
    body: 'MotoGear https://cdn.razorpay.com/static/assets/email/check-success-green.png ₹39,900.00 Paid Successfully Payment Id pay_ABC123 Method card XXXX-XXXX-XXXX-1111 Paid On 11 Jul, 2026 3:05:10 PM',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 3990000, merchant: 'Motogear', last4: '1111', instrument: 'CC', txnAt: '2026-07-11T15:05:10', kind: 'spend' },
  },
  {
    name: 'Bank statement from an unknown sender is ignored',
    from: 'noreplyunionbank@ubi.bank.in',
    subject: 'Statement of Account for Account Number XXXX0000',
    body: 'Account Statement Dear Customer, Greetings from Union Bank of India&#33;&#33; We are enclosing a copy of your account statement.',
    expect: { status: 'ignored' },
  },
  {
    name: 'Google payment method notice is ignored',
    from: 'payments-noreply@google.com',
    subject: 'Google Payments: Payment method updated',
    body: 'A payment method, such as a credit card or bank account, was updated for your payments profile.',
    expect: { status: 'ignored' },
  },
  {
    name: 'CSS leaking into a text part is stripped',
    from: 'payment-report@payu.in',
    subject: 'Your Order at TVS MOTOR COMPANY LIMITED is successful',
    body: "PayU Transaction Email @import url('https://fonts.googleapis.com/css2?family=Noto+Sans'); /* Reset */ body, table, td { -webkit-text-size-adjust:100%; } @media (max-width: 600px) { .x { width: 100% !important; } } Rs. 1250.00 Paid to TVS MOTOR COMPANY LIMITED via upi on 09 Sep 2026 10:15 AM",
    expect: { status: 'parsed', direction: 'debit', amountPaise: 125000, merchant: 'Tvs Motor Company', last4: null, instrument: 'UPI', txnAt: '2026-09-09T10:15:00', kind: 'spend', category: 'vehicle' },
  },
  {
    name: 'ICICI card bill payment received is not spend',
    from: 'credit_cards@icici.bank.in',
    subject: 'Payment received on your ICICI Bank Credit Card',
    body: 'Dear Customer, Aug 03,2026 Greetings from ICICI Bank! We have received payment of INR 12,345.67 on your ICICI Bank Credit Card account 4000 XXXX XXXX 0001 on 03-Aug-2026. Looking forward to more opportunities to be of service to you.',
    expect: { status: 'parsed', direction: 'credit', amountPaise: 1234567, merchant: '', last4: '0001', instrument: 'CC', txnAt: '2026-08-03T12:00:00', kind: null },
  },
  {
    name: 'ICICI declined transaction is ignored',
    from: 'credit_cards@icici.bank.in',
    subject: 'Transaction alert for your ICICI Bank Credit Card',
    body: 'Dear Customer, As the transaction amount exceeds the per transaction limit set for contactless transactions, your transaction of INR 1,234.56 using your ICICI Bank Credit Card XX0001, has been declined on Aug 13, 2026 at 03:29:50. To complete the transaction, please insert your card.',
    expect: { status: 'ignored' },
  },
  {
    name: 'ICICI net-banking transfer names the payee',
    from: 'customernotification@icici.bank.in',
    subject: 'Transaction alert for Fund Transfer on ICICI Bank using Internet Banking.',
    body: 'Dear Customer, You have made an online ICICI fund transfer payment of Rs. 25,000.00 towards A Landlord from your ICICI Bank Savings Account XXXX0001 on Aug 01, 2026 at 05:18 a.m.. The Transaction ID is TX0000001.',
    receivedAt: '2026-08-01T05:19:00',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 2500000, merchant: 'A Landlord', last4: '0001', instrument: 'ACCOUNT', txnAt: '2026-08-01T05:18:00', kind: 'spend', category: null },
  },
  {
    name: 'ICICI 12-hour time is read as PM when the email came in the afternoon',
    from: 'credit_cards@icici.bank.in',
    subject: 'Transaction alert for your ICICI Bank Credit Card',
    body: 'Dear Customer, Your ICICI Bank Credit Card XX0001 has been used for a transaction of INR 1,00,000.00 on Sep 09, 2026 at 05:50:12. Info: TVS MOTOR COMPANY LIMI. The Available Credit Limit on your card is INR 50,000.00.',
    receivedAt: '2026-09-09T17:51:00',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 10000000, merchant: 'Tvs Motor Company Limi', last4: '0001', instrument: 'CC', txnAt: '2026-09-09T17:50:12', kind: 'spend', category: 'vehicle' },
  },
  {
    name: 'ICICI early-morning time stays AM',
    from: 'credit_cards@icici.bank.in',
    subject: 'Transaction alert for your ICICI Bank Credit Card',
    body: 'Dear Customer, Your ICICI Bank Credit Card XX0001 has been used for a transaction of INR 299.00 on Sep 26, 2026 at 05:50:12. Info: YOUTUBE WITH STANDING INSTRUCTION AB12CD. The Available Credit Limit on your card is INR 50,000.00.',
    receivedAt: '2026-09-26T05:51:00',
    expect: { status: 'parsed', direction: 'debit', amountPaise: 29900, merchant: 'Youtube', last4: '0001', instrument: 'CC', txnAt: '2026-09-26T05:50:12', kind: 'spend', category: 'personal' },
  },
  {
    name: 'Interest credit is not spend',
    from: 'customernotification@icici.bank.in',
    subject: 'Transaction alert for your ICICI Bank Account',
    body: 'Dear Customer, ICICI Bank Account XX001 has been credited with INR 1,000.00 on 30-Sep-26. Info: XX001 INT PD 30-06 TO 29-09. The Available Balance is INR 1,00,000.00.',
    expect: { status: 'ignored' },
  },
  {
    name: 'Bank awareness mail quoting an amount is ignored',
    from: 'services@custcomm.icici.bank.in',
    subject: 'Don’t fall for fake delivery links',
    body: 'Fraudster may call you and create urgency. If you click on the link, the page will ask you for a token payment of ₹25 or ₹50.',
    expect: { status: 'ignored' },
  },
  {
    name: 'ICICI standing-instruction advance notice is not a spend',
    from: 'credit_cards@icici.bank.in',
    subject: 'Upcoming payment notification: Standing Instructions on your ICICI Bank Credit Card',
    body: 'Dear Customer, As per the Standing Instruction registered on your ICICI Bank Credit Card XX0001, INR 299.00 will be debited towards YOUTUBEGOOGLE on Oct 26, 2026.',
    expect: { status: 'ignored' },
  },
  {
    name: 'Advance notice with a neutral subject is caught by its wording',
    from: 'credit_cards@icici.bank.in',
    subject: 'Standing Instruction alert',
    body: 'Dear Customer, INR 299.00 will be debited from your ICICI Bank Credit Card XX0001 on Oct 26, 2026 towards YOUTUBEGOOGLE.',
    expect: { status: 'ignored' },
  },
  {
    name: 'OTP email is ignored',
    from: 'alerts@hdfcbank.net',
    subject: 'OTP for transaction on HDFC Bank Credit Card',
    body: '123456 is the OTP for transaction of INR 2,000.00 at AMAZON on your HDFC Bank card ending 1234. Valid for 10 mins.',
    expect: { status: 'ignored' },
  },
  {
    name: 'Statement email is ignored',
    from: 'estatement@icicibank.com',
    subject: 'Your ICICI Bank Credit Card Statement for September 2026',
    body: 'Dear Customer, your statement is ready. Total amount due Rs 15,000.00. Minimum amount due Rs 750.00.',
    expect: { status: 'ignored' },
  },
  {
    name: 'Unknown sender is unparsed',
    from: 'noreply@somewallet.com',
    subject: 'Payment successful',
    body: 'You paid Rs 99 to Netflix.',
    expect: { status: 'unparsed' },
  },
].map((f) => ({ receivedAt: RECEIVED, ...f })) as Fixture[];

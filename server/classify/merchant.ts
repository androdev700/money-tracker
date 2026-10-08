export interface Merchant {
  name: string;
  key: string;
}

const GATEWAY_PREFIX = /^(?:upi|pos|ecom|vps|vin|pyu|rsp|razorpay|rzp|payu|ccavenue|billdesk|paytm|phonepe|bharatpe|gpay|cashfree|juspay|ipay|ind\*|mps)\s*[*\/:-]\s*/i;
const LEGAL_SUFFIX = /\b(?:private|privat|priva|pvt|limited|limite|ltd|llp|inc|corp(?:oration)?|technologies|tech|services|solutions|retail|india|ind)\b\.?/gi;
const VPA = /^([\w.-]+)@([\w.]+)$/;

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * Turn whatever the bank wrote ("VPA swiggy@icici SWIGGY", "UPI/P2M/427912345678/SWIGGY LIMITED",
 * "PYU*Swiggy Food") into a display name and a stable key that merchant rules match on.
 */
export function normaliseMerchant(raw: string | null | undefined): Merchant {
  if (!raw?.trim()) return { name: 'Unknown', key: 'unknown' };

  let s = raw
    .trim()
    .replace(/^(?:refund|reversal|reversed)\s*(?:from|of|for|by)?\s*/i, '')
    .replace(/^VPA\s+/i, '')
    .replace(/\.(?:co\.in|in|com|net)\b/gi, '');
  let vpa: string | null = null;

  // "handle@bank Name" — keep the name when the bank gave one, else fall back to the VPA.
  const vpaWithName = s.match(/^(\S+@[\w.]+)\s+(.+)$/);
  if (vpaWithName) {
    vpa = vpaWithName[1];
    s = vpaWithName[2];
  } else if (VPA.test(s)) {
    vpa = s;
  }

  // UPI/P2M/<ref>/<name>/... — the payee name is the first segment with letters after the ref.
  if (/^UPI[\/-]/i.test(s)) {
    const parts = s.split(/[\/-]/).slice(1).filter((p) => /[a-z]{3,}/i.test(p) && !/^(p2m|p2a|cr|dr|upi)$/i.test(p));
    s = parts[0] ?? s;
    if (VPA.test(s)) vpa = s;
  }

  if (vpa && VPA.test(s)) {
    const handle = s.match(VPA)![1];
    // Shop QR handles (paytmqr..., bharatpe.90...) carry no name; the full VPA is the only stable id.
    if (/qr|\d{6,}/i.test(handle)) return { name: `UPI ${handle.slice(0, 18)}`, key: s.toLowerCase() };
    s = handle.replace(/[._-]+/g, ' ');
  }

  for (let i = 0; i < 3 && GATEWAY_PREFIX.test(s); i++) s = s.replace(GATEWAY_PREFIX, '');

  s = s
    .replace(LEGAL_SUFFIX, ' ')
    .replace(/\d{4,}/g, ' ')
    .replace(/[^a-z0-9&' ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return { name: titleCase(raw.slice(0, 40)), key: raw.toLowerCase().slice(0, 60) };

  const key = s.toLowerCase().replace(/[&']/g, '').split(' ').filter(Boolean).slice(0, 3).join(' ');
  return { name: titleCase(s).slice(0, 60), key: key || 'unknown' };
}

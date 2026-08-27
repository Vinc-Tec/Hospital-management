// Displays an indicative price in the visitor's local currency next to
// the real USD price. This is informational only -- the actual amount
// charged is always the plan's stored USD price, converted by the
// payment gateway itself at checkout time (see lib/payments.ts). We
// never use this conversion to decide what to bill.

// Reasonably broad country -> currency map. Falls back to USD (i.e. no
// conversion shown) for anything not listed here.
const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', CH: 'CHF',
  // Eurozone
  FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR',
  IE: 'EUR', LU: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR',
  // CEMAC (Central Africa) -- XAF
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  // UEMOA (West Africa) -- XOF
  SN: 'XOF', CI: 'XOF', BJ: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', TG: 'XOF', GW: 'XOF',
  // Other African currencies
  NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', UG: 'UGX', TZ: 'TZS', RW: 'RWF',
  EG: 'EGP', MA: 'MAD', DZ: 'DZD', TN: 'TND', ET: 'ETB', ZM: 'ZMW',
  // Middle East / Asia
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', IN: 'INR', PK: 'PKR', BD: 'BDT',
  CN: 'CNY', JP: 'JPY', KR: 'KRW', PH: 'PHP', ID: 'IDR', MY: 'MYR', SG: 'SGD',
  VN: 'VND', TH: 'THB',
  // Americas
  BR: 'BRL', MX: 'MXN', AR: 'ARS', CO: 'COP', CL: 'CLP', PE: 'PEN',
  // Other
  RU: 'RUB', TR: 'TRY', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', SE: 'SEK',
  NO: 'NOK', DK: 'DKK', IL: 'ILS', UA: 'UAH',
};

export function detectLocalCurrency(): string {
  try {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    const region = locale.split('-')[1]?.toUpperCase();
    if (region && COUNTRY_CURRENCY[region]) return COUNTRY_CURRENCY[region];
  } catch {
    // fall through to default
  }
  return 'USD';
}

let ratesCache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getRates(): Promise<Record<string, number> | null> {
  if (ratesCache && Date.now() - ratesCache.fetchedAt < CACHE_TTL_MS) {
    return ratesCache.rates;
  }
  try {
    const cached = sessionStorage.getItem('hc-fx-rates');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        ratesCache = parsed;
        return parsed.rates;
      }
    }
  } catch {
    // ignore malformed cache
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result !== 'success' || !data.rates) return null;
    ratesCache = { rates: data.rates, fetchedAt: Date.now() };
    try { sessionStorage.setItem('hc-fx-rates', JSON.stringify(ratesCache)); } catch { /* storage may be unavailable */ }
    return data.rates;
  } catch {
    return null; // offline, API down, etc. -- caller just won't show a conversion
  }
}

export async function convertFromUsd(usdAmount: number, targetCurrency: string): Promise<{ amount: number; currency: string } | null> {
  if (targetCurrency === 'USD') return null; // nothing to show, already USD
  const rates = await getRates();
  const rate = rates?.[targetCurrency];
  if (!rate) return null;
  return { amount: usdAmount * rate, currency: targetCurrency };
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

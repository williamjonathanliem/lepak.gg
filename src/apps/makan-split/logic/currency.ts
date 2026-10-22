// Currencies for Makan Split. Amounts are kept in each currency's smallest unit (sen,
// cents), and some currencies have none (yen, won, rupiah, dong), so `decimals` matters.

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  decimals: 0 | 2;
  /** What the sales tax on the bill is called there. */
  tax: string;
  /** Cash bills round to this many smallest units (Malaysia: 5 sen). */
  cashStep?: number;
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'MYR', symbol: 'RM', name: 'Malaysian ringgit', decimals: 2, tax: 'SST', cashStep: 5 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', decimals: 2, tax: 'GST' },
  { code: 'BND', symbol: 'B$', name: 'Brunei dollar', decimals: 2, tax: 'Tax' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian rupiah', decimals: 0, tax: 'PPN' },
  { code: 'THB', symbol: '฿', name: 'Thai baht', decimals: 2, tax: 'VAT' },
  { code: 'PHP', symbol: '₱', name: 'Philippine peso', decimals: 2, tax: 'VAT' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese dong', decimals: 0, tax: 'VAT' },
  { code: 'KHR', symbol: '៛', name: 'Cambodian riel', decimals: 0, tax: 'VAT' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese yuan', decimals: 2, tax: 'VAT' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollar', decimals: 2, tax: 'Tax' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan dollar', decimals: 0, tax: 'VAT' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', decimals: 0, tax: 'Tax' },
  { code: 'KRW', symbol: '₩', name: 'South Korean won', decimals: 0, tax: 'VAT' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', decimals: 2, tax: 'GST' },
  { code: 'AED', symbol: 'AED ', name: 'UAE dirham', decimals: 2, tax: 'VAT' },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi riyal', decimals: 2, tax: 'VAT' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar', decimals: 2, tax: 'GST' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollar', decimals: 2, tax: 'GST' },
  { code: 'USD', symbol: 'US$', name: 'US dollar', decimals: 2, tax: 'Tax' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', decimals: 2, tax: 'Tax' },
  { code: 'GBP', symbol: '£', name: 'British pound', decimals: 2, tax: 'VAT' },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, tax: 'VAT' },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss franc', decimals: 2, tax: 'VAT' },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira', decimals: 2, tax: 'VAT' },
];

export const currencyOf = (code: string): Currency =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;

const factor = (c: Currency) => 10 ** c.decimals;

/** "RM12.30", "¥1,200", "Rp125,000" */
export function money(units: number, code: string): string {
  const c = currencyOf(code);
  const n = (units / factor(c)).toLocaleString('en-US', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  });
  return `${c.symbol}${n}`;
}

/** Reads what people type ("12.3", "RM 12", "7,50", "1,200" for yen) into smallest units,
 * or null if it isn't a price. */
export function parseAmount(raw: string, code: string): number | null {
  const c = currencyOf(code);
  let s = raw
    .trim()
    .replace(/^[^\d]+/, '')
    .replace(/\s/g, '');
  if (c.decimals === 0) s = s.replace(/[,.](?=\d{3}\b)/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,(?=\d{3}\b)/g, '');
  const pattern = c.decimals === 0 ? /^\d{1,9}$/ : /^\d{1,7}(\.\d{0,2})?$/;
  if (!pattern.test(s)) return null;
  return Math.round(parseFloat(s) * factor(c));
}

/** Major units (as on a receipt, e.g. 7.50) to smallest units. */
export const toUnits = (amount: number, code: string) =>
  Math.max(0, Math.round(amount * factor(currencyOf(code))));

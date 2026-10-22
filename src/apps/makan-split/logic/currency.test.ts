import { CURRENCIES, currencyOf, money, parseAmount, toUnits } from './currency';
import { BillSchema, newBill, splitBill } from './split';

describe('currencies', () => {
  it('has unique codes and falls back to ringgit', () => {
    expect(new Set(CURRENCIES.map((c) => c.code)).size).toBe(CURRENCIES.length);
    expect(currencyOf('XXX').code).toBe('MYR');
  });

  it('writes amounts with the right decimals', () => {
    expect(money(1230, 'MYR')).toBe('RM12.30');
    expect(money(1200, 'JPY')).toBe('¥1,200');
    expect(money(125000, 'IDR')).toBe('Rp125,000');
    expect(money(999, 'SGD')).toBe('S$9.99');
  });

  it('reads what people type in each currency', () => {
    expect(parseAmount('12.3', 'MYR')).toBe(1230);
    expect(parseAmount('RM 12', 'MYR')).toBe(1200);
    expect(parseAmount('7,50', 'EUR')).toBe(750);
    expect(parseAmount('1,250.50', 'USD')).toBe(125050);
    expect(parseAmount('1,200', 'JPY')).toBe(1200);
    expect(parseAmount('25.000', 'IDR')).toBe(25000); // Indonesian thousands dot
    expect(parseAmount('12.5', 'JPY')).toBeNull();
    expect(parseAmount('abc', 'MYR')).toBeNull();
    expect(toUnits(7.5, 'MYR')).toBe(750);
    expect(toUnits(800, 'KRW')).toBe(800);
  });

  it('only rounds for cash where the currency does it', () => {
    const items = [{ name: 'x', price: 1001, shares: [] }];
    const base = { ...newBill(['A']), items, servicePct: 0, sstPct: 0 };
    expect(splitBill({ ...base, currency: 'MYR' }).grand).toBe(1000);
    expect(splitBill({ ...base, currency: 'SGD' }).grand).toBe(1001);
  });

  it('reads older saved bills as ringgit', () => {
    const { currency: _, ...old } = newBill(['A']);
    void _;
    expect(BillSchema.parse(old).currency).toBe('MYR');
  });
});

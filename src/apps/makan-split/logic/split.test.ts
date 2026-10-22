import {
  allocate,
  decodeBill,
  encodeBill,
  newBill,
  parsePrice,
  rm,
  roundTo5Sen,
  splitBill,
  summaryText,
  type Bill,
} from './split';

describe('makan split', () => {
  it('allocates whole sen that always add up', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [3, 1])).toEqual([750, 250]);
    expect(allocate(7, [0, 0])).toEqual([4, 3]);
    expect(allocate(5, [])).toEqual([]);
    for (const total of [1, 99, 12345]) {
      expect(allocate(total, [7, 3, 11, 1]).reduce((a, b) => a + b)).toBe(total);
    }
  });

  it('rounds to 5 sen the Malaysian way', () => {
    expect([101, 102, 103, 104, 106, 107, 108, 109].map(roundTo5Sen)).toEqual([
      100, 100, 105, 105, 105, 105, 110, 110,
    ]);
  });

  it('reads prices people type', () => {
    expect(parsePrice('12.3')).toBe(1230);
    expect(parsePrice('RM 12')).toBe(1200);
    expect(parsePrice('7,50')).toBe(750);
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('1.234')).toBeNull();
  });

  it('splits a mamak bill with service charge, SST and rounding', () => {
    const bill: Bill = {
      ...newBill(['Ali', 'Mei', 'Ravi']),
      items: [
        { name: 'Roti canai', price: 300, shares: [0] },
        { name: 'Maggi goreng', price: 900, shares: [1] },
        { name: 'Teh tarik jug', price: 1200, shares: [] }, // everyone
      ],
    };
    const s = splitBill(bill);
    expect(s.subtotal).toBe(2400);
    expect(s.service).toBe(240); // 10%
    expect(s.sst).toBe(158); // 6% of 26.40 = 1.584
    expect(s.grand).toBe(2800); // 27.98 rounds to 28.00
    expect(s.rounding).toBe(2);
    expect(s.people.map((p) => p.ordered)).toEqual([700, 1300, 400]);
    expect(s.people.reduce((a, p) => a + p.total, 0)).toBe(s.grand);
  });

  it('caps a discount at the bill, and can skip charges', () => {
    const bill: Bill = {
      ...newBill(['A', 'B']),
      items: [{ name: 'x', price: 1000, shares: [] }],
      servicePct: 0,
      sstPct: 0,
      discount: 5000,
      round5: false,
    };
    expect(splitBill(bill).grand).toBe(0);
  });

  it('writes a message for the group chat', () => {
    const bill: Bill = {
      ...newBill(['Ali', 'Mei']),
      items: [{ name: 'x', price: 2000, shares: [] }],
    };
    const text = summaryText(bill, splitBill(bill));
    expect(text).toContain('paid by *Ali*');
    expect(text).toContain(`• *Mei*: ${rm(1165)}`);
    expect(text).toContain('↳ x (shared by 2)');
    expect(text).toContain('Ali’s own share');
    expect(text).not.toContain('• *Ali*');
  });

  it('shares a bill by link and rejects junk', () => {
    const bill: Bill = {
      ...newBill(['Siti', 'Zé']),
      items: [{ name: 'Nasi', price: 850, shares: [1] }],
    };
    expect(decodeBill(encodeBill(bill))).toEqual(bill);
    expect(decodeBill('not-a-bill')).toBeNull();
    // older links were plain JSON in base64
    const utf8 = new TextEncoder().encode(JSON.stringify(bill));
    const old = btoa(String.fromCharCode(...utf8)).replace(/=+$/, '');
    expect(decodeBill(old)).toEqual(bill);
  });

  it('keeps share links short', () => {
    const bill: Bill = {
      ...newBill(['William', 'Test 1', 'Test 2', 'Test 3']),
      items: [0, 1, 2, 3].map((k) => ({
        name: k < 2 ? 'Caffe Latte - G' : 'Caramel Frappuccino - V',
        price: k < 2 ? 1540 : 1800,
        shares: [k],
      })),
    };
    const plainJson = btoa(JSON.stringify(bill)).length;
    expect(encodeBill(bill).length).toBeLessThan(plainJson * 0.5);
  });

  it('takes service charge and tax as fixed amounts too', () => {
    const bill: Bill = {
      ...newBill(['A', 'B']),
      items: [{ name: 'x', price: 2000, shares: [] }],
      serviceFixed: 300,
      sstFixed: 150,
      round5: false,
    };
    const s = splitBill(bill);
    expect(s).toMatchObject({ service: 300, sst: 150, grand: 2450 });
    expect(summaryText(bill, s)).toContain('RM3.00 service charge and RM1.50 SST');
  });
});

describe('the receipt image', () => {
  it('lists everyone, the charges and the total', async () => {
    const { receiptRows } = await import('./receiptImage');
    const bill: Bill = {
      ...newBill(['Ali', 'Mei']),
      items: [{ name: 'x', price: 2000, shares: [] }],
      serviceFixed: 300,
    };
    const rows = receiptRows(bill, splitBill(bill), '23 Oct');
    const text = rows.map((r) =>
      'text' in r ? r.text : 'left' in r ? `${r.left}=${r.right}` : r.kind,
    );
    expect(text).toContain('ALI (PAID)=RM12.20');
    expect(text).toContain('SERVICE CHG=RM3.00');
    expect(text).toContain('SST 6%=RM1.38');
    expect(text).toContain('TOTAL=RM24.40');
  });
});

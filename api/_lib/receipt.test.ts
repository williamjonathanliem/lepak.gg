import { toBillParts } from './receipt';

describe('reading a receipt into a bill', () => {
  it('turns RM into sen, adds quantities to names, and drops junk lines', () => {
    const out = toBillParts({
      isReceipt: true,
      items: [
        { name: ' Teh   tarik ', quantity: 2, lineTotal: 7 },
        { name: 'Roti canai', quantity: 1, lineTotal: 1.5 },
        { name: 'Free water', quantity: 1, lineTotal: 0 },
        { name: '', quantity: 1, lineTotal: 3 },
      ],
      servicePct: 10,
      sstPct: 6,
      discount: 2.5,
      total: 43.85,
    });
    expect(out.items).toEqual([
      { name: '2x Teh tarik', price: 700 },
      { name: 'Roti canai', price: 150 },
    ]);
    expect(out).toMatchObject({ servicePct: 10, sstPct: 6, discount: 250, total: 4385 });
  });

  it('ignores charges that make no sense', () => {
    const out = toBillParts({
      isReceipt: true,
      items: [],
      servicePct: 300,
      sstPct: -6,
      discount: -1,
      total: 0,
    });
    expect(out).toMatchObject({ servicePct: 0, sstPct: 0, discount: 0 });
  });
});

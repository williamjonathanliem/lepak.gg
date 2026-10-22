import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppHeader } from '../../components/AppHeader';
import { SearchSelect } from '../../components/SearchSelect';
import { getNickname } from '../../lib/identity';
import { readStorage, writeStorage } from '../../lib/storage';
import {
  MAX_ITEMS,
  MAX_PEOPLE,
  BillSchema,
  decodeBill,
  encodeBill,
  newBill,
  splitBill,
  summaryText,
  type Bill,
} from './logic/split';
import { CURRENCIES, currencyOf, money, parseAmount } from './logic/currency';
import { drawReceipt, receiptRows } from './logic/receiptImage';
import { scanReceipt } from './logic/scan';

// Makan Split: add who's eating and what was ordered, tap who shared each item, and get
// what everyone owes the person who paid (service charge, tax and cash rounding included),
// in any of the currencies in logic/currency.ts.
// All on this device; "Share" puts the whole bill in a link (/split#b=...).

const ACCENT = '#ffb86b';
const STORE_KEY = 'lepak.split.bill';
/** Button shape without a colour; BTN is the plain white one. */
const BTN_BASE =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const BTN = `${BTN_BASE} bg-paper text-ink`;
const INPUT = 'min-h-11 min-w-0 border-3 border-ink bg-paper px-3 text-base';
const PERSON_COLOURS = ['#ffd23f', '#ff8fd0', '#7ee081', '#4fd1e8', '#b9a2ff', '#ffb86b'];

function startingBill(): Bill {
  const shared = /#b=([\w-]+)/.exec(location.hash)?.[1];
  const fromLink = shared ? decodeBill(shared) : null;
  if (fromLink) return fromLink;
  try {
    const saved = BillSchema.safeParse(JSON.parse(readStorage(STORE_KEY) ?? 'null'));
    if (saved.success) return saved.data;
  } catch {
    // start fresh
  }
  return newBill([getNickname() ?? 'Me']);
}

export default function MakanSplit() {
  const [bill, setBill] = useState<Bill>(startingBill);
  const [person, setPerson] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemError, setItemError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function scan(file: File) {
    setScanning(true);
    setScanNote(null);
    try {
      const r = await scanReceipt(file, bill.currency);
      if (!r.items.length) throw new Error('Could not find any items on that receipt.');
      const room = MAX_ITEMS - bill.items.length;
      const added = r.items.slice(0, room).map((it) => ({ ...it, shares: [] as number[] }));
      setBill((b) => ({
        ...b,
        items: [...b.items, ...added],
        servicePct: r.servicePct || (r.total ? 0 : b.servicePct),
        sstPct: r.sstPct || (r.total ? 0 : b.sstPct),
        discount: r.discount || b.discount,
      }));
      setScanNote({
        ok: true,
        text: `Got ${added.length} item${added.length === 1 ? '' : 's'}${r.total ? `. The receipt says ${m(r.total)} in total` : ''}. Check the prices, then tap who had what.`,
      });
    } catch (e) {
      setScanNote({
        ok: false,
        text: e instanceof Error ? e.message : 'Could not read that receipt.',
      });
    } finally {
      setScanning(false);
    }
  }
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);

  useEffect(() => writeStorage(STORE_KEY, JSON.stringify(bill)), [bill]);

  const split = splitBill(bill);
  const cur = currencyOf(bill.currency);
  const m = (units: number) => money(units, bill.currency);
  const [receiptDate] = useState(() =>
    new Date().toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );
  const payer = bill.people[bill.payer] ?? bill.people[0] ?? '';

  function addPerson(e: FormEvent) {
    e.preventDefault();
    const name = person.trim().slice(0, 20);
    if (!name || bill.people.length >= MAX_PEOPLE) return;
    setBill((b) => ({ ...b, people: [...b.people, name] }));
    setPerson('');
  }

  function removePerson(k: number) {
    setBill((b) => ({
      ...b,
      people: b.people.filter((_, i) => i !== k),
      items: b.items.map((it) => ({
        ...it,
        shares: it.shares.filter((i) => i !== k).map((i) => (i > k ? i - 1 : i)),
      })),
      payer: b.payer === k ? 0 : b.payer > k ? b.payer - 1 : b.payer,
    }));
  }

  function addItem(e: FormEvent) {
    e.preventDefault();
    const price = parseAmount(itemPrice, bill.currency);
    if (price === null) return setItemError(cur.decimals ? 'Price like 12.50' : 'Price like 1200');
    if (bill.items.length >= MAX_ITEMS) return setItemError(`Up to ${MAX_ITEMS} items.`);
    setItemError('');
    const name = itemName.trim().slice(0, 40) || `Item ${bill.items.length + 1}`;
    setBill((b) => ({ ...b, items: [...b.items, { name, price, shares: [] }] }));
    setItemName('');
    setItemPrice('');
  }

  function toggleShare(item: number, k: number) {
    setBill((b) => ({
      ...b,
      items: b.items.map((it, i) =>
        i !== item
          ? it
          : {
              ...it,
              shares: it.shares.includes(k)
                ? it.shares.filter((x) => x !== k)
                : [...it.shares, k].sort((x, y) => x - y),
            },
      ),
    }));
  }

  function copy(kind: 'text' | 'link') {
    const link = `${location.origin}/split#b=${encodeBill(bill)}`;
    const value = kind === 'text' ? summaryText(bill, split, `See the bill: ${link}`) : link;
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function downloadPng() {
    const blob = await drawReceipt(receiptRows(bill, split, receiptDate));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `makan-split-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-dvh">
      <title>Makan Split · Lepak.gg</title>
      <AppHeader app={{ name: 'Makan Split', to: '/split', accent: ACCENT }} />
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-gutter py-[clamp(24px,5vw,56px)] lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-8">
          <div>
            <h1 className="heading-lg m-0">Makan Split.</h1>
            <p className="mt-2 mb-0 text-mute">
              Who ordered what, plus service charge and tax. Everyone pays their real share.
            </p>
            <div className="mt-4 w-full max-w-sm">
              <SearchSelect
                label="Currency"
                placeholder="Type to search, e.g. baht"
                items={CURRENCIES.map((c) => ({
                  id: c.code,
                  label: `${c.symbol.trim()} · ${c.name}`,
                  detail: c.code,
                }))}
                value={bill.currency}
                onChange={(code) => {
                  if (code === bill.currency) return;
                  if (
                    bill.items.length &&
                    currencyOf(code).decimals !== cur.decimals &&
                    !window.confirm(
                      'Prices already added will be read in the new currency. Go ahead?',
                    )
                  ) {
                    return;
                  }
                  setBill((b) => ({ ...b, currency: code }));
                }}
              />
            </div>
          </div>

          {/* people */}
          <section aria-labelledby="ppl-h" className="flex flex-col gap-3">
            <h2 id="ppl-h" className="m-0 text-xl font-black uppercase">
              1. Who’s eating
            </h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {bill.people.map((p, k) => (
                <li
                  key={`${p}-${k}`}
                  className="flex min-h-11 items-center gap-2 border-3 border-ink bg-paper py-1 pr-3 pl-1.5 font-bold shadow-hard-sm has-[button]:pr-0"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-8 place-items-center rounded-full border-2 border-ink font-mono text-sm uppercase"
                    style={{ background: PERSON_COLOURS[k % PERSON_COLOURS.length] }}
                  >
                    {[...p][0]}
                  </span>
                  {p}
                  {k === bill.payer && (
                    <span className="font-mono text-[11px] font-normal">paid</span>
                  )}
                  {bill.people.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePerson(k)}
                      aria-label={`Remove ${p}`}
                      className="min-h-10 min-w-10 cursor-pointer border-0 bg-transparent font-mono text-lg"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={addPerson} className="flex flex-wrap gap-2">
              <label htmlFor="split-person" className="sr-only">
                Name
              </label>
              <input
                id="split-person"
                value={person}
                maxLength={20}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="Add a name"
                className={`${INPUT} flex-1`}
              />
              <button
                type="submit"
                disabled={!person.trim() || bill.people.length >= MAX_PEOPLE}
                className={BTN}
              >
                Add
              </button>
            </form>
          </section>

          {/* items */}
          <section aria-labelledby="items-h" className="flex flex-col gap-3">
            <h2 id="items-h" className="m-0 text-xl font-black uppercase">
              2. What was ordered
            </h2>
            <p className="m-0 text-sm text-mute">
              Tap who had each thing. Nobody tapped means everyone shared it.
            </p>
            <div className="flex flex-wrap items-center gap-3 border-3 border-dashed border-ink p-3">
              <button
                type="button"
                disabled={scanning}
                onClick={() => photoRef.current?.click()}
                className={`push ${BTN_BASE} shadow-hard-sm`}
                style={{ background: ACCENT }}
              >
                {scanning ? 'Reading the receipt...' : '📷 Scan a receipt'}
              </button>
              <span className="text-sm text-mute">
                Snap the bill and the items fill in by themselves.
              </span>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void scan(f);
                  e.target.value = '';
                }}
              />
              {scanNote && (
                <p
                  role="status"
                  className={`m-0 w-full font-mono text-sm ${scanNote.ok ? '' : 'font-bold'}`}
                >
                  {scanNote.ok ? '✓ ' : '! '}
                  {scanNote.text}
                </p>
              )}
              <p className="m-0 w-full font-mono text-xs text-mute">
                The photo goes to Google’s Gemini to be read, then is forgotten.
              </p>
            </div>
            {bill.items.length > 0 && (
              <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
                {bill.items.map((it, i) => (
                  <li key={i} className="flex flex-col gap-2 border-ink p-3 not-last:border-b-3">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate font-bold">{it.name}</span>
                      <span className="font-mono text-sm font-bold">{m(it.price)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setBill((b) => ({ ...b, items: b.items.filter((_, j) => j !== i) }))
                        }
                        aria-label={`Remove ${it.name}`}
                        className="min-h-10 min-w-10 cursor-pointer border-0 bg-transparent font-mono text-lg"
                      >
                        ×
                      </button>
                    </div>
                    <div
                      role="group"
                      aria-label={`Who had ${it.name}`}
                      className="flex flex-wrap gap-1.5"
                    >
                      {bill.people.map((p, k) => {
                        const on = it.shares.includes(k);
                        return (
                          <button
                            key={`${p}-${k}`}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleShare(i, k)}
                            className={`min-h-9 cursor-pointer border-2 border-ink px-2.5 font-mono text-xs font-bold ${on ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
                          >
                            {p}
                          </button>
                        );
                      })}
                      {it.shares.length === 0 && (
                        <span className="self-center font-mono text-xs text-mute">· everyone</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addItem} className="flex flex-wrap gap-2">
              <label htmlFor="split-item" className="sr-only">
                Item
              </label>
              <input
                id="split-item"
                value={itemName}
                maxLength={40}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Roti canai"
                className={`${INPUT} flex-[2_1_160px]`}
              />
              <label htmlFor="split-price" className="sr-only">
                Price in RM
              </label>
              <input
                id="split-price"
                value={itemPrice}
                inputMode="decimal"
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder={`${cur.symbol.trim()} ${cur.decimals ? '3.00' : '1200'}`}
                className={`${INPUT} flex-[1_1_90px]`}
              />
              <button type="submit" disabled={!itemPrice.trim()} className={BTN}>
                Add item
              </button>
            </form>
            {itemError && <p className="m-0 font-mono text-sm font-bold">{itemError}</p>}
          </section>

          {/* charges */}
          <section aria-labelledby="charges-h" className="flex flex-col gap-3">
            <h2 id="charges-h" className="m-0 text-xl font-black uppercase">
              3. Charges and who paid
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ChargeInput
                label="Service charge"
                pct={bill.servicePct}
                maxPct={30}
                fixed={bill.serviceFixed}
                currency={bill.currency}
                onPct={(v) => setBill((b) => ({ ...b, servicePct: v }))}
                onFixed={(v) => setBill((b) => ({ ...b, serviceFixed: v }))}
              />
              <ChargeInput
                label={cur.tax}
                pct={bill.sstPct}
                maxPct={20}
                fixed={bill.sstFixed}
                currency={bill.currency}
                onPct={(v) => setBill((b) => ({ ...b, sstPct: v }))}
                onFixed={(v) => setBill((b) => ({ ...b, sstFixed: v }))}
              />
              <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
                Discount {cur.symbol.trim()}
                <input
                  inputMode="decimal"
                  defaultValue={bill.discount ? (bill.discount / 100).toFixed(2) : ''}
                  placeholder="0.00"
                  onChange={(e) =>
                    setBill((b) => ({
                      ...b,
                      discount: parseAmount(e.target.value, b.currency) ?? 0,
                    }))
                  }
                  className={`${INPUT} font-sans`}
                />
              </label>
              <label className="flex flex-col gap-1 font-mono text-xs font-bold uppercase">
                Paid by
                <select
                  value={bill.payer}
                  onChange={(e) => setBill((b) => ({ ...b, payer: Number(e.target.value) }))}
                  className={`${INPUT} font-sans`}
                >
                  {bill.people.map((p, k) => (
                    <option key={`${p}-${k}`} value={k}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {cur.cashStep && (
                <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 self-end font-mono text-sm">
                  <input
                    type="checkbox"
                    checked={bill.round5}
                    onChange={(e) => setBill((b) => ({ ...b, round5: e.target.checked }))}
                    className="size-5"
                  />
                  Round the bill to {cur.cashStep} sen
                </label>
              )}
            </div>
          </section>
        </div>

        {/* results: printed like a torn-off receipt (.receipt in styles/index.css) */}
        <aside aria-labelledby="owe-h" className="flex h-fit flex-col gap-4 lg:sticky lg:top-20">
          <div className="receipt-wrap">
            <div className="receipt flex flex-col gap-3 px-5 pt-8 pb-9 font-mono text-sm">
              <div className="text-center">
                <p className="m-0 text-base font-bold tracking-widest">LEPAK.GG</p>
                <p className="m-0 text-xs">MAKAN SPLIT</p>
                <p className="m-0 text-xs">{receiptDate}</p>
              </div>
              <hr className="receipt-rule" />
              <h2 id="owe-h" className="m-0 text-center text-base font-bold uppercase">
                Who owes {payer}
              </h2>
              {split.subtotal === 0 ? (
                <p className="m-0 text-center">Add what was ordered to see the split.</p>
              ) : (
                <>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {split.people.map((p, k) => (
                      <li key={`${p.name}-${k}`} className="flex items-baseline gap-2">
                        <span className="min-w-0 truncate font-bold uppercase">
                          {p.name}
                          {k === bill.payer && <span className="font-normal"> (paid)</span>}
                        </span>
                        <span aria-hidden="true" className="receipt-dots" />
                        <span className="text-base font-bold">{m(p.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <hr className="receipt-rule" />
                  <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs">
                    <dt>SUBTOTAL</dt>
                    <dd className="m-0 text-right">{m(split.subtotal)}</dd>
                    {split.service > 0 && (
                      <>
                        <dt>
                          SERVICE CHG{bill.serviceFixed === null ? ` ${bill.servicePct}%` : ''}
                        </dt>
                        <dd className="m-0 text-right">{m(split.service)}</dd>
                      </>
                    )}
                    {split.sst > 0 && (
                      <>
                        <dt>
                          {cur.tax.toUpperCase()}
                          {bill.sstFixed === null ? ` ${bill.sstPct}%` : ''}
                        </dt>
                        <dd className="m-0 text-right">{m(split.sst)}</dd>
                      </>
                    )}
                    {split.discount > 0 && (
                      <>
                        <dt>DISCOUNT</dt>
                        <dd className="m-0 text-right">-{m(split.discount)}</dd>
                      </>
                    )}
                    {split.rounding !== 0 && (
                      <>
                        <dt>ROUNDING ADJ</dt>
                        <dd className="m-0 text-right">
                          {split.rounding > 0 ? '' : '-'}
                          {m(Math.abs(split.rounding))}
                        </dd>
                      </>
                    )}
                  </dl>
                  <hr className="receipt-rule" />
                  <p className="m-0 flex justify-between text-lg font-bold">
                    <span>TOTAL</span>
                    <span>{m(split.grand)}</span>
                  </p>
                </>
              )}
              <hr className="receipt-rule" />
              <p className="m-0 text-center text-xs">
                TERIMA KASIH. SILA DATANG LAGI!
                <br />
                {bill.items.length} ITEM{bill.items.length === 1 ? '' : 'S'} · {bill.people.length}{' '}
                PAX
              </p>
            </div>
          </div>
          {split.subtotal > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy('text')}
                className={`push ${BTN_BASE} bg-ink text-paper shadow-hard-sm`}
              >
                {copied === 'text' ? 'Copied!' : 'Copy for WhatsApp'}
              </button>
              <button type="button" onClick={() => copy('link')} className={BTN}>
                {copied === 'link' ? 'Link copied!' : 'Share bill link'}
              </button>
              <button type="button" onClick={() => void downloadPng()} className={BTN}>
                Download PNG
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (bill.items.length && !window.confirm('Start a new bill? This one is cleared.')) {
                return;
              }
              history.replaceState(null, '', '/split');
              setBill(newBill(bill.people));
            }}
            className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs underline"
          >
            New bill (same people)
          </button>
        </aside>
      </main>
    </div>
  );
}

/** A charge typed as a percent of the bill, or as a fixed amount (a % / RM switch). */
function ChargeInput({
  label,
  pct,
  maxPct,
  fixed,
  currency,
  onPct,
  onFixed,
}: {
  label: string;
  pct: number;
  maxPct: number;
  fixed: number | null;
  currency: string;
  onPct: (v: number) => void;
  onFixed: (v: number | null) => void;
}) {
  const cur = currencyOf(currency);
  const asAmount = fixed !== null;
  const id = `charge-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const toggle = (on: boolean) =>
    `min-h-11 min-w-11 cursor-pointer border-0 px-2 font-mono text-sm font-bold ${on ? 'bg-ink text-paper' : 'bg-paper text-ink'}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs font-bold uppercase">
        {label} {asAmount ? cur.symbol.trim() : '%'}
      </label>
      <div className="flex min-w-0">
        {asAmount ? (
          <input
            key="amount"
            id={id}
            inputMode="decimal"
            defaultValue={fixed ? money(fixed, currency).replace(/^[^\d]+/, '') : ''}
            placeholder={cur.decimals ? '0.00' : '0'}
            onChange={(e) => onFixed(parseAmount(e.target.value, currency) ?? 0)}
            className={`${INPUT} w-full font-sans`}
          />
        ) : (
          <input
            key="pct"
            id={id}
            type="number"
            min={0}
            max={maxPct}
            value={pct}
            onChange={(e) => onPct(Math.min(maxPct, Math.max(0, Number(e.target.value) || 0)))}
            className={`${INPUT} w-full font-sans`}
          />
        )}
        <div
          role="group"
          aria-label={`${label} as`}
          className="flex shrink-0 border-3 border-l-0 border-ink"
        >
          <button
            type="button"
            aria-pressed={!asAmount}
            onClick={() => onFixed(null)}
            className={`${toggle(!asAmount)} border-r-2 border-ink`}
          >
            %
          </button>
          <button
            type="button"
            aria-pressed={asAmount}
            onClick={() => !asAmount && onFixed(0)}
            className={toggle(asAmount)}
          >
            {cur.symbol.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

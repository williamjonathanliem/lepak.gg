import { useState } from 'react';
import { formatNumber } from '../logic/calc';
import { CATEGORIES, convert } from '../logic/units';
import { INPUT } from '../style';
import { Field } from '../ui';

export default function Units() {
  const [catId, setCatId] = useState(CATEGORIES[0]!.id);
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const [from, setFrom] = useState(cat.units[0]!.id);
  const [to, setTo] = useState(cat.units[1]!.id);
  const [value, setValue] = useState('1');

  const n = Number.parseFloat(value);
  const result = Number.isFinite(n) ? formatNumber(convert(n, catId, from, to)) : '';

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="What to convert" className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === catId}
            onClick={() => {
              setCatId(c.id);
              setFrom(c.units[0]!.id);
              setTo(c.units[1]!.id);
            }}
            className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold uppercase ${c.id === catId ? 'bg-ink text-paper' : 'bg-paper'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="flex flex-col gap-2">
          <Field label="Value" id="u-val">
            <input
              id="u-val"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${INPUT} text-xl`}
            />
          </Field>
          <Field label="From" id="u-from">
            <select
              id="u-from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT}
            >
              {cat.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          type="button"
          aria-label="Swap units"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-0.5 min-h-12 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-xl font-bold"
        >
          ⇄
        </button>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase">Result</span>
            <output
              aria-live="polite"
              className="flex h-12 items-center border-3 border-ink bg-[#7ee081] px-3 font-mono text-xl font-bold"
            >
              {result || '-'}
            </output>
          </div>
          <Field label="To" id="u-to">
            <select id="u-to" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT}>
              {cat.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}

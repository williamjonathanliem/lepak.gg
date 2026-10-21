import { useState } from 'react';
import { formatBase, parseBase, type Base } from '../logic/text';
import { INPUT } from '../style';
import { Field, Output } from '../ui';

const BASES: { base: Base; label: string }[] = [
  { base: 10, label: 'Decimal' },
  { base: 2, label: 'Binary' },
  { base: 8, label: 'Octal' },
  { base: 16, label: 'Hex' },
];

export default function Bases() {
  const [input, setInput] = useState('255');
  const [from, setFrom] = useState<Base>(10);
  const n = parseBase(input, from);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Number" id="b-in">
          <input
            id="b-in"
            value={input}
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            aria-invalid={input && n === null ? true : undefined}
            className={`${INPUT} text-xl`}
          />
        </Field>
        <Field label="Written in" id="b-from">
          <select
            id="b-from"
            value={from}
            onChange={(e) => setFrom(Number(e.target.value) as Base)}
            className={INPUT}
          >
            {BASES.map((b) => (
              <option key={b.base} value={b.base}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {input && n === null ? (
        <p role="alert" className="m-0 font-mono text-sm font-bold">
          ! That's not a valid {BASES.find((b) => b.base === from)!.label.toLowerCase()} number.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {BASES.map((b) => (
            <Output
              key={b.base}
              label={`${b.label} (base ${b.base})`}
              value={n === null ? '' : formatBase(n, b.base)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

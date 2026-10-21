import { useState } from 'react';
import { contrastRatio, parseHex, toHex, toHsl, wcag } from '../logic/colour';
import { INPUT } from '../style';
import { Field, Output } from '../ui';

function Picker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const rgb = parseHex(value);
  return (
    <Field label={label} id={id}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={rgb ? toHex(rgb) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-14 cursor-pointer border-3 border-ink bg-paper p-1"
        />
        <input
          id={id}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
      </div>
    </Field>
  );
}

export default function Colour() {
  const [fg, setFg] = useState('#000000');
  const [bg, setBg] = useState('#f9fafb');
  const a = parseHex(fg);
  const b = parseHex(bg);
  const ratio = a && b ? contrastRatio(a, b) : null;
  const pass = ratio ? wcag(ratio) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Picker id="c-fg" label="Text colour" value={fg} onChange={setFg} />
        <Picker id="c-bg" label="Background" value={bg} onChange={setBg} />
      </div>
      {a && b && ratio && pass && (
        <>
          <div
            className="border-3 border-ink p-6 text-center"
            style={{ color: toHex(a), background: toHex(b) }}
          >
            <p className="m-0 text-3xl font-black">Big heading text</p>
            <p className="m-0 mt-2">Normal paragraph text looks like this.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4" aria-live="polite">
            <p className="m-0 text-4xl font-black">{ratio.toFixed(2)} : 1</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0 font-mono text-sm">
              {(
                [
                  ['AA text', pass.aaNormal],
                  ['AA large', pass.aaLarge],
                  ['AAA text', pass.aaaNormal],
                  ['AAA large', pass.aaaLarge],
                ] as const
              ).map(([label, ok]) => (
                <li
                  key={label}
                  className={`border-2 border-ink px-2 py-1 font-bold ${ok ? 'bg-[#7ee081]' : 'bg-hot'}`}
                >
                  {ok ? '✓' : '✕'} {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[a, b].map((c, i) => {
              const hsl = toHsl(c);
              return (
                <div key={i} className="contents">
                  <Output label={`${i ? 'Background' : 'Text'} HEX`} value={toHex(c)} />
                  <Output label="RGB" value={`rgb(${c.r}, ${c.g}, ${c.b})`} />
                  <Output label="HSL" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} />
                </div>
              );
            })}
          </div>
          <p className="m-0 font-mono text-xs text-mute">
            Aim for at least 4.5 : 1 for normal text (WCAG AA), 3 : 1 for big text.
          </p>
        </>
      )}
    </div>
  );
}

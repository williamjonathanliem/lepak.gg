import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../../lib/useReducedMotion';

// A fake Makan Split receipt that prints line by line, then starts again. Uses the same
// torn-receipt style as the real app (.receipt in styles/index.css). Nothing talks to the
// network; the numbers are a worked example (RM37 of food + 10% service + 6% SST,
// rounded to 5 sen), not real people.

const LINES: { left: string; right: string; strong?: boolean }[] = [
  { left: 'AIMAN', right: 'RM13.20', strong: true },
  { left: 'MEI', right: 'RM19.10', strong: true },
  { left: 'KOPIBOI (PAID)', right: 'RM10.85', strong: true },
  { left: 'SERVICE CHG 10%', right: 'RM3.70' },
  { left: 'SST 6%', right: 'RM2.44' },
];

const PRINT_MS = 520;
const HOLD_MS = 2600;

export function SplitDemo() {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const all = LINES.length + 1; // + the total

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => setShown((n) => (n >= all ? 0 : n + 1)),
      shown >= all ? HOLD_MS : PRINT_MS,
    );
    return () => clearTimeout(t);
  }, [reduced, shown, all]);

  const visible = reduced ? all : shown;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#ffb86b] p-[6cqmin] [container-type:size]">
      <div className="receipt-wrap w-[min(78cqw,70cqh)]">
        <div className="receipt flex flex-col gap-[1.6cqmin] px-[5cqmin] pt-[7cqmin] pb-[8cqmin] font-mono text-[3.2cqmin]">
          <div className="text-center">
            <p className="m-0 text-[4cqmin] font-bold tracking-widest">LEPAK.GG</p>
            <p className="m-0">MAKAN SPLIT · MAMAK NIGHT</p>
          </div>
          <hr className="receipt-rule" />
          {LINES.map((l, i) => (
            <p
              key={l.left}
              className={`m-0 flex items-baseline gap-[1.5cqmin] transition-opacity duration-200 ${i < visible ? 'opacity-100' : 'opacity-0'} ${l.strong ? 'font-bold' : ''}`}
            >
              <span className="truncate">{l.left}</span>
              <span aria-hidden="true" className="receipt-dots" />
              <span>{l.right}</span>
            </p>
          ))}
          <hr className="receipt-rule" />
          <p
            className={`m-0 flex justify-between text-[5cqmin] font-bold transition-opacity duration-200 ${visible >= all ? 'opacity-100' : 'opacity-0'}`}
          >
            <span>TOTAL</span>
            <span>RM43.15</span>
          </p>
          <p className="m-0 text-center text-[2.8cqmin]">TERIMA KASIH. SILA DATANG LAGI!</p>
        </div>
      </div>
    </div>
  );
}

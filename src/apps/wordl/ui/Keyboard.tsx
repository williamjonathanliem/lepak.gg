import type { Mark } from '../logic/wordl';
import { MARK_STYLE } from './marks';

const ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];

interface KeyboardProps {
  marks: Record<string, Mark>;
  onKey: (key: string) => void;
}

/** On-screen keyboard. Keys take the colour of the best result for that letter so far. */
export function Keyboard({ marks, onKey }: KeyboardProps) {
  return (
    <div className="flex w-full max-w-[520px] shrink-0 flex-col gap-1.5" aria-label="Keyboard">
      {ROWS.map((row) => (
        <div key={row} className="flex gap-1.5">
          {[...row].map((k) => {
            if (k === '+' || k === '-') {
              const enter = k === '+';
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onKey(enter ? 'enter' : 'back')}
                  aria-label={enter ? 'Enter' : 'Backspace'}
                  className="flex h-14 flex-[1.5] cursor-pointer items-center justify-center border-3 border-ink bg-ink font-mono text-xs font-bold text-paper uppercase active:translate-y-0.5"
                >
                  {enter ? 'Enter' : '⌫'}
                </button>
              );
            }
            const mark = marks[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => onKey(k)}
                className={`flex h-14 flex-1 cursor-pointer items-center justify-center border-3 font-sans text-lg font-black uppercase active:translate-y-0.5 ${
                  mark ? MARK_STYLE[mark] : 'border-ink bg-paper text-ink'
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

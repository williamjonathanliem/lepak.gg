import { useState, type FormEvent } from 'react';
import { CalcError, evaluate, formatNumber, type AngleMode } from '../logic/calc';

const KEYS = [
  ['sin(', 'cos(', 'tan(', '^', '('],
  ['ln(', 'log(', 'sqrt(', '!', ')'],
  ['7', '8', '9', '÷', 'pi'],
  ['4', '5', '6', '×', 'e'],
  ['1', '2', '3', '-', '%'],
  ['0', '.', 'ANS', '+', '='],
];

interface Line {
  expr: string;
  result: string;
}

export default function Calc() {
  const [expr, setExpr] = useState('');
  const [mode, setMode] = useState<AngleMode>('deg');
  const [history, setHistory] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ans = history[0]?.result ?? '';

  function run(e?: FormEvent) {
    e?.preventDefault();
    try {
      const result = formatNumber(evaluate(expr, mode));
      setHistory((h) => [{ expr, result }, ...h].slice(0, 20));
      setExpr(result);
      setError(null);
    } catch (err) {
      setError(err instanceof CalcError ? err.message : 'Could not work that out');
    }
  }

  function press(k: string) {
    if (k === '=') return run();
    if (k === 'ANS') return setExpr((x) => x + ans);
    setExpr((x) => x + k);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={run} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="calc-in" className="font-mono text-xs uppercase">
            Expression
          </label>
          <div
            role="radiogroup"
            aria-label="Angle unit"
            className="flex border-2 border-ink font-mono text-xs font-bold"
          >
            {(['deg', 'rad'] as AngleMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-9 cursor-pointer border-0 px-3 uppercase ${mode === m ? 'bg-ink text-paper' : 'bg-paper'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <input
          id="calc-in"
          value={expr}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="e.g. 2sin(30) + sqrt(16)"
          onChange={(e) => {
            setExpr(e.target.value);
            setError(null);
          }}
          className="h-16 w-full border-3 border-ink bg-paper px-4 text-right font-mono text-2xl"
          aria-describedby="calc-err"
        />
        <p id="calc-err" role="alert" className="m-0 min-h-5 font-mono text-sm font-bold">
          {error ? `! ${error}` : ''}
        </p>
      </form>
      <div className="grid grid-cols-5 gap-1.5">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={`min-h-12 cursor-pointer border-3 border-ink font-mono text-lg font-bold active:translate-y-0.5 ${
              k === '=' ? 'bg-[#7ee081]' : /^\d|\.$/.test(k) ? 'bg-paper' : 'bg-soft'
            }`}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setExpr((x) => x.slice(0, -1))}
          className="col-span-3 min-h-12 cursor-pointer border-3 border-ink bg-paper font-mono font-bold uppercase"
        >
          ⌫ Delete
        </button>
        <button
          type="button"
          onClick={() => setExpr('')}
          className="col-span-2 min-h-12 cursor-pointer border-3 border-ink bg-ink font-mono font-bold text-paper uppercase"
        >
          Clear
        </button>
      </div>
      {history.length > 0 && (
        <ol
          className="m-0 flex list-none flex-col gap-1 border-3 border-ink p-3 font-mono text-sm"
          aria-label="History"
        >
          {history.map((h, i) => (
            <li key={i} className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setExpr(h.expr)}
                className="cursor-pointer truncate border-0 bg-transparent p-0 text-left text-mute underline"
              >
                {h.expr}
              </button>
              <b>= {h.result}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

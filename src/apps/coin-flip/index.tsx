import { useRef, useState } from 'react';
import { AppHeader } from '../../components/AppHeader';
import { cryptoRandomInt } from '../../lib/roomCode';
import { useReducedMotion } from '../../lib/useReducedMotion';
import {
  addFlip,
  counts,
  flipSide,
  longestStreak,
  newCoin,
  roundWinner,
  type CoinState,
  type Side,
} from './logic/coin';

// Coin Flip: tap the coin. Fair (the browser's crypto random), with a best-of-3/5 mode and
// optional meanings for each side ("Heads: mamak, tails: tapau").

const ACCENT = '#ffd23f';
const FLIP_MS = 1100;
const BTN =
  'min-h-11 cursor-pointer border-3 border-ink px-4 font-mono text-sm font-bold uppercase disabled:cursor-wait';

export default function CoinFlip() {
  const reduced = useReducedMotion();
  const [state, setState] = useState<CoinState>(() => newCoin(1));
  const [rotation, setRotation] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [last, setLast] = useState<Side | null>(null);
  const [labels, setLabels] = useState<Record<Side, string>>({ heads: '', tails: '' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const winner = roundWinner(state);
  const c = counts(state.flips);
  const streak = longestStreak(state.flips);
  const name = (s: Side) => (s === 'heads' ? 'Heads' : 'Tails');
  const meaning = (s: Side) => labels[s].trim();

  function flip() {
    if (flipping || winner) return;
    const side = flipSide(cryptoRandomInt);
    // Spin a few times and stop on the right face (tails is the back, half a turn on).
    const base = rotation - (rotation % 360) + 360 * 5;
    setRotation(base + (side === 'tails' ? 180 : 0));
    const land = () => {
      setLast(side);
      setState((s) => addFlip(s, side));
      setFlipping(false);
    };
    if (reduced) return land();
    setFlipping(true);
    setLast(null);
    timer.current = setTimeout(land, FLIP_MS);
  }

  function reset(bestOf: CoinState['bestOf'] = state.bestOf) {
    if (timer.current) clearTimeout(timer.current);
    setFlipping(false);
    setLast(null);
    setState(newCoin(bestOf));
  }

  const face = (s: Side) => (
    <span
      className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-[6px] border-ink text-center [backface-visibility:hidden]"
      style={{
        background: s === 'heads' ? ACCENT : '#f9fafb',
        transform: s === 'tails' ? 'rotateY(180deg)' : undefined,
        boxShadow: 'inset 0 0 0 10px rgb(0 0 0 / 0.08)',
      }}
    >
      <span className="text-[64px] leading-none font-black">{s === 'heads' ? 'H' : 'T'}</span>
      <span className="mt-1 max-w-[70%] truncate font-mono text-xs font-bold uppercase">
        {meaning(s) || name(s)}
      </span>
    </span>
  );

  return (
    <div className="min-h-dvh">
      <title>Coin Flip · Lepak.gg</title>
      <AppHeader app={{ name: 'Coin Flip', to: '/coin', accent: ACCENT }} />
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
        <div className="text-center">
          <h1 className="heading-lg m-0">Coin Flip.</h1>
          <p className="mt-2 mb-0 text-mute">Can’t decide? Let the coin do it. Tap to flip.</p>
        </div>

        <div role="group" aria-label="Mode" className="flex border-3 border-ink">
          {([1, 3, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={state.bestOf === n}
              onClick={() => reset(n)}
              className={`min-h-11 cursor-pointer border-0 px-4 font-mono text-sm font-bold uppercase not-last:border-r-3 not-last:border-ink ${state.bestOf === n ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
            >
              {n === 1 ? 'Single' : `Best of ${n}`}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={flip}
          disabled={!!winner}
          aria-label={flipping ? 'Flipping' : 'Flip the coin'}
          className="relative size-56 cursor-pointer rounded-full border-0 bg-transparent p-0 [perspective:900px] disabled:cursor-default"
        >
          <span
            className="absolute inset-0 [transform-style:preserve-3d]"
            style={{
              transform: `rotateY(${rotation}deg)`,
              transition: reduced ? 'none' : `transform ${FLIP_MS}ms cubic-bezier(.2,.7,.25,1)`,
            }}
          >
            {face('heads')}
            {face('tails')}
          </span>
        </button>

        <p aria-live="polite" className="m-0 min-h-10 text-center text-3xl font-black uppercase">
          {winner
            ? `${name(winner)} wins${meaning(winner) ? `: ${meaning(winner)}` : ''}!`
            : flipping
              ? '...'
              : last
                ? `${name(last)}${meaning(last) ? `: ${meaning(last)}` : ''}`
                : ''}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {winner ? (
            <button
              type="button"
              onClick={() => reset()}
              className={`push ${BTN} shadow-hard`}
              style={{ background: ACCENT }}
            >
              New round
            </button>
          ) : (
            <button
              type="button"
              onClick={flip}
              disabled={flipping}
              className={`push ${BTN} bg-ink text-paper shadow-hard`}
            >
              {flipping ? 'Flipping...' : 'Flip'}
            </button>
          )}
          {state.flips.length > 0 && !winner && (
            <button type="button" onClick={() => reset()} className={`${BTN} bg-paper`}>
              Reset
            </button>
          )}
        </div>

        {state.flips.length > 0 && (
          <section aria-label="Flips so far" className="flex w-full flex-col items-center gap-3">
            <ol className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
              {state.flips.slice(-30).map((f, i) => (
                <li
                  key={i}
                  className="grid size-8 place-items-center rounded-full border-2 border-ink font-mono text-xs font-bold"
                  style={{ background: f === 'heads' ? ACCENT : '#f9fafb' }}
                  aria-label={name(f)}
                >
                  {f === 'heads' ? 'H' : 'T'}
                </li>
              ))}
            </ol>
            <p className="m-0 font-mono text-sm">
              Heads {c.heads} · Tails {c.tails}
              {state.bestOf === 1 && streak && streak.length > 2
                ? ` · longest streak: ${streak.length} ${name(streak.side).toLowerCase()} in a row`
                : ''}
            </p>
          </section>
        )}

        <details className="w-full max-w-md border-3 border-ink">
          <summary className="min-h-11 cursor-pointer px-4 py-2.5 font-mono text-sm font-bold uppercase">
            What does each side mean?
          </summary>
          <div className="flex flex-col gap-3 border-t-3 border-ink p-4">
            {(['heads', 'tails'] as const).map((s) => (
              <label key={s} className="flex flex-col gap-1 font-mono text-sm font-bold">
                {name(s)} means
                <input
                  value={labels[s]}
                  maxLength={20}
                  onChange={(e) => setLabels((l) => ({ ...l, [s]: e.target.value }))}
                  placeholder={s === 'heads' ? 'e.g. Makan here' : 'e.g. Tapau'}
                  className="min-h-12 border-3 border-ink bg-paper px-3 font-sans text-base font-normal"
                />
              </label>
            ))}
          </div>
        </details>
      </main>
    </div>
  );
}

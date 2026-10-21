import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bomb } from '../../apps/katabomb/ui/Bomb';
import { SectionLabel } from '../../components/SectionLabel';
import { DEMO } from '../../copy/landing';
import { useReducedMotion } from '../../lib/useReducedMotion';

// A scripted, fake KataBomb round that loops, so visitors see the game in two seconds.
// Nothing here talks to the network.

const PLAYERS = [
  { name: 'aiman', color: '#ffd23f', emoji: '🧋' },
  { name: 'mei', color: '#ff8fd0', emoji: '🐼' },
  { name: 'kopiboi', color: '#4fd1e8', emoji: '🔥' },
];

/** Each beat: who holds the bomb, the prompt, what they type, and whether it lands. */
const SCRIPT = [
  { who: 0, prompt: 'tio', word: 'nation', ok: true },
  { who: 1, prompt: 'ang', word: 'mango', ok: true },
  { who: 2, prompt: 'ble', word: 'blee', ok: false },
  { who: 0, prompt: 'ing', word: 'lepaking', ok: false },
  { who: 1, prompt: 'ock', word: 'clock', ok: true },
  { who: 2, prompt: 'ter', word: 'otter', ok: true },
] as const;

const TYPE_MS = 110;
const HOLD_MS = 900;

export function LiveDemo() {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  const [typed, setTyped] = useState(0);
  const step = SCRIPT[beat % SCRIPT.length]!;
  const done = typed >= step.word.length;

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => {
        if (!done) setTyped((n) => n + 1);
        else {
          setBeat((b) => b + 1);
          setTyped(0);
        }
      },
      done ? HOLD_MS : TYPE_MS,
    );
    return () => clearTimeout(t);
  }, [reduced, done, typed, beat]);

  const text = reduced ? step.word : step.word.slice(0, typed);
  const boom = done && !step.ok && !reduced;
  // First seat on the left, then clockwise, like the real game.
  const angle = (i: number) => (i / PLAYERS.length) * 2 * Math.PI + Math.PI;
  // Turns go round in seat order, so the arrow only ever turns forward.
  const pointer = 180 + beat * (360 / PLAYERS.length);
  const fuse = reduced ? 0.6 : 1 - typed / (step.word.length + 4);
  const at = text.indexOf(step.prompt);

  return (
    <section
      aria-labelledby="demo-heading"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] border-b-3 border-ink"
    >
      <div className="flex flex-col justify-center gap-6 px-gutter py-[clamp(48px,6vw,88px)]">
        <SectionLabel number="002" title={DEMO.label} />
        <h2 id="demo-heading" className="heading-lg m-0">
          {DEMO.heading[0]}
          <br />
          {DEMO.heading[1]}
        </h2>
        <p className="m-0 max-w-[460px] text-[19px]">{DEMO.body}</p>
        <div className="flex flex-wrap gap-3">
          {DEMO.games.map((g) => (
            <Link
              key={g.to}
              to={g.to}
              className="push inline-flex min-h-12 items-center border-3 border-ink px-5 font-mono font-bold text-ink uppercase no-underline shadow-hard"
              style={{ background: g.color }}
            >
              {g.label} →
            </Link>
          ))}
        </div>
      </div>

      {/* the fake game */}
      <div
        aria-hidden="true"
        className="relative min-h-[380px] overflow-hidden max-[680px]:h-[clamp(340px,100vw,460px)] bg-night bg-[radial-gradient(ellipse_at_50%_50%,#3a3029_0%,#1d1915_45%,var(--color-night)_80%)] [container-type:size] min-[700px]:border-l-3 max-[700px]:border-t-3 border-ink"
      >
        <div
          key={boom ? beat : 'calm'}
          className={`absolute inset-0 m-auto size-[min(92cqw,92cqh)] ${boom ? 'animate-shake' : ''}`}
        >
          {/* middle: prompt card, bomb in its ring with the arrow, typed letters */}
          <div className="absolute top-1/2 left-1/2 z-10 flex w-[50%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[2.5cqmin]">
            <span
              key={step.prompt}
              className="animate-pop border-3 border-paper/80 bg-ink px-[3cqmin] py-[1cqmin] font-sans text-[8cqmin] leading-none font-black text-paper uppercase"
            >
              {step.prompt}
            </span>
            <div className="relative size-[22cqmin]">
              <div
                className="absolute top-1/2 left-1/2 h-0 w-0 transition-transform duration-500 ease-[cubic-bezier(.2,.9,.3,1.2)]"
                style={{ transform: `rotate(${pointer}deg)` }}
              >
                <div className="absolute top-0 left-[12.5cqmin] flex -translate-y-1/2 items-center">
                  <div className="h-[1.3cqmin] w-[6cqmin] rounded-l-full bg-paper/85" />
                  <div className="h-0 w-0 border-y-[2.2cqmin] border-l-[3.4cqmin] border-y-transparent border-l-paper/85" />
                </div>
              </div>
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="rgb(255 255 255 / 0.04)"
                  stroke="rgb(255 255 255 / 0.12)"
                  strokeWidth="4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke={fuse < 0.35 ? 'var(--color-hot)' : 'rgb(255 255 255 / 0.55)'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - fuse}
                  className="transition-[stroke-dashoffset] duration-100 ease-linear"
                />
              </svg>
              <div className="absolute inset-[16%]">
                <Bomb fraction={fuse} danger={fuse < 0.35} />
              </div>
            </div>
            <div className="flex min-h-[6cqmin] justify-center gap-[0.5cqmin]">
              {[...text].map((ch, i) => {
                const hit = at >= 0 && i >= at && i < at + step.prompt.length;
                const bad = done && !step.ok;
                return (
                  <span
                    key={i}
                    className={`flex size-[5.4cqmin] animate-pop items-center justify-center border-2 font-sans text-[3.6cqmin] font-black uppercase ${
                      bad
                        ? 'border-hot text-hot'
                        : done && step.ok
                          ? 'border-[#7ee081] text-[#7ee081]'
                          : hit
                            ? 'border-hot bg-hot/15 text-paper'
                            : 'border-paper/25 bg-ink text-paper/90'
                    }`}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>
          {boom && (
            <div className="absolute top-1/2 left-1/2 z-20 flex size-[36cqmin] -translate-x-1/2 -translate-y-1/2 animate-burst items-center justify-center bg-hot font-sans text-[8cqmin] font-black text-ink [clip-path:polygon(50%_0,61%_30%,95%_20%,72%_47%,100%_70%,66%_70%,62%_100%,45%_74%,15%_96%,24%_64%,0_45%,30%_38%,12%_8%,42%_25%)]">
              BOOM
            </div>
          )}
          {/* players */}
          {PLAYERS.map((p, i) => {
            const a = angle(i);
            const active = i === step.who;
            return (
              <div
                key={p.name}
                className="absolute flex w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-paper"
                style={{ left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 36 * Math.sin(a)}%` }}
              >
                <span className="mb-1 text-[4cqmin] font-black">{p.name}</span>
                <span
                  className={`flex size-[13cqmin] items-center justify-center border-3 text-[6cqmin] transition-transform ${active ? 'scale-110 border-paper shadow-[0_0_0_4px_var(--color-hot)]' : 'border-ink'}`}
                  style={{ background: p.color }}
                >
                  {p.emoji}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

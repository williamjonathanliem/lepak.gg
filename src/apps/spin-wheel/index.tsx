import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AppHeader } from '../../components/AppHeader';
import { Confetti } from '../../components/Confetti';
import { cryptoRandomInt } from '../../lib/roomCode';
import { readStorage, writeStorage } from '../../lib/storage';
import { useReducedMotion } from '../../lib/useReducedMotion';
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  PRESETS,
  cleanOptions,
  pickIndex,
  sliceColour,
  spinTo,
} from './logic/wheel';

// Spin the Wheel: type the options (one per line), spin, done. Lists are kept on this
// device, and "Share" makes a link with the list in it (?o=a|b|c), so friends get the same
// wheel. Fair: the winner is picked with the browser's crypto random, then the wheel is
// spun to land on it.

const ACCENT = '#b9a2ff';
const SPIN_MS = 4200;
const STORE_KEY = 'lepak.wheel.options';
const BTN =
  'min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50';
const SIZE = 320;
const R = SIZE / 2 - 6;

function startingOptions(fromLink: string | null): string[] {
  if (fromLink) {
    const shared = cleanOptions(fromLink.split('|'));
    if (shared.length >= MIN_OPTIONS) return shared;
  }
  try {
    const saved = JSON.parse(readStorage(STORE_KEY) ?? 'null') as unknown;
    if (Array.isArray(saved)) {
      const list = cleanOptions(saved.filter((x): x is string => typeof x === 'string'));
      if (list.length >= MIN_OPTIONS) return list;
    }
  } catch {
    // fall through to the default
  }
  return PRESETS[0]!.options;
}

/** One slice of the wheel as an SVG path, starting at the top and going clockwise. */
function slicePath(i: number, count: number): string {
  const c = SIZE / 2;
  const a0 = ((i / count) * 360 - 90) * (Math.PI / 180);
  const a1 = (((i + 1) / count) * 360 - 90) * (Math.PI / 180);
  const large = 360 / count > 180 ? 1 : 0;
  const p = (a: number) => `${c + R * Math.cos(a)} ${c + R * Math.sin(a)}`;
  return `M ${c} ${c} L ${p(a0)} A ${R} ${R} 0 ${large} 1 ${p(a1)} Z`;
}

export default function SpinWheel() {
  const reduced = useReducedMotion();
  const [params] = useSearchParams();
  const [options, setOptions] = useState<string[]>(() => startingOptions(params.get('o')));
  const [draft, setDraft] = useState(() => options.join('\n'));
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [removeWinner, setRemoveWinner] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => writeStorage(STORE_KEY, JSON.stringify(options)), [options]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const count = options.length;
  const canSpin = count >= MIN_OPTIONS && !spinning;

  function applyList(list: string[]) {
    const clean = cleanOptions(list);
    setOptions(clean);
    setDraft(clean.join('\n'));
    setWinner(null);
  }

  function spin() {
    if (!canSpin) return;
    const index = pickIndex(count, cryptoRandomInt);
    setRotation((r) => spinTo(r, index, count, cryptoRandomInt));
    setWinner(null);
    const land = () => {
      const won = options[index]!;
      setWinner(won);
      setHistory((h) => [won, ...h].slice(0, 10));
      setSpinning(false);
      if (removeWinner && count > MIN_OPTIONS) {
        const rest = options.filter((_, i) => i !== index);
        setOptions(rest);
        setDraft(rest.join('\n'));
        setRotation(0);
      }
    };
    if (reduced) return land();
    setSpinning(true);
    timer.current = setTimeout(land, SPIN_MS);
  }

  function share() {
    const url = new URL('/wheel', location.origin);
    url.searchParams.set('o', options.join('|'));
    void navigator.clipboard?.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const fontSize = count > 16 ? 10 : count > 10 ? 12 : 14;
  const maxChars = count > 16 ? 12 : 16;

  return (
    <div className="min-h-dvh">
      <title>Spin the Wheel · Lepak.gg</title>
      <AppHeader app={{ name: 'Spin the Wheel', to: '/wheel', accent: ACCENT }} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
        <div>
          <h1 className="heading-lg m-0">Spin the Wheel.</h1>
          <p className="mt-2 mb-0 text-mute">
            Makan mana, who pays, who goes first. Type the options, spin, no more “anything lah”.
          </p>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-10">
          {/* the wheel */}
          <div className="flex flex-col items-center gap-5">
            <div className="relative" style={{ width: SIZE, maxWidth: '100%' }}>
              {/* pointer at the top */}
              <svg
                viewBox="0 0 40 36"
                className="absolute -top-3 left-1/2 z-10 w-10 -translate-x-1/2"
                aria-hidden="true"
              >
                <path d="M4 2 H36 L20 34 Z" fill="#000" />
                <path d="M10 6 H30 L20 26 Z" fill={ACCENT} />
              </svg>
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="block h-auto w-full"
                role="img"
                aria-label={`A wheel with ${count} options`}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition:
                    spinning && !reduced
                      ? `transform ${SPIN_MS}ms cubic-bezier(.12,.72,.12,1)`
                      : 'none',
                }}
              >
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 3} fill="#000" />
                {options.map((o, i) => {
                  const mid = ((i + 0.5) / count) * 360;
                  const label = o.length > maxChars ? `${o.slice(0, maxChars - 1)}…` : o;
                  return (
                    <g key={o}>
                      <path
                        d={slicePath(i, count)}
                        fill={sliceColour(i, count)}
                        stroke="#000"
                        strokeWidth={3}
                      />
                      {/* along the slice's middle line, reading outwards to the rim */}
                      <text
                        x={SIZE / 2 + R - 14}
                        y={SIZE / 2}
                        transform={`rotate(${mid - 90} ${SIZE / 2} ${SIZE / 2})`}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fontSize={fontSize}
                        fontWeight={800}
                        fontFamily="Archivo, sans-serif"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <button
                type="button"
                onClick={spin}
                disabled={!canSpin}
                className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-[5px] border-ink bg-paper font-mono text-sm font-black uppercase shadow-hard-sm disabled:cursor-wait"
              >
                {spinning ? '...' : 'Spin'}
              </button>
            </div>

            <p
              aria-live="polite"
              className="m-0 min-h-12 max-w-[320px] text-center text-[clamp(24px,4vw,34px)] leading-tight font-black uppercase"
            >
              {winner ?? (spinning ? 'Spinning...' : '')}
            </p>
            {history.length > 1 && (
              <p className="m-0 max-w-[320px] text-center font-mono text-xs text-mute">
                Before: {history.slice(1).join(', ')}
              </p>
            )}
          </div>

          {/* the options */}
          <div className="flex w-full max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wheel-options" className="font-mono text-sm font-bold">
                Options, one per line ({count}/{MAX_OPTIONS})
              </label>
              <textarea
                id="wheel-options"
                value={draft}
                rows={8}
                onChange={(e) => {
                  setDraft(e.target.value);
                  const list = cleanOptions(e.target.value.split('\n'));
                  if (list.length >= MIN_OPTIONS && !spinning) {
                    setOptions(list);
                    setWinner(null);
                  }
                }}
                className="border-3 border-ink bg-paper p-3 text-base"
              />
              {count < MIN_OPTIONS && (
                <p className="m-0 font-mono text-xs font-bold">Add at least two options.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs uppercase">Start from</span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={spinning}
                    onClick={() => applyList(p.options)}
                    className={BTN}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 font-mono text-sm">
              <input
                type="checkbox"
                checked={removeWinner}
                onChange={(e) => setRemoveWinner(e.target.checked)}
                className="size-5"
              />
              Take the winner off after each spin
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={spin}
                disabled={!canSpin}
                className={`push ${BTN} shadow-hard`}
                style={{ background: ACCENT }}
              >
                Spin
              </button>
              <button type="button" onClick={share} className={BTN}>
                {copied ? 'Link copied!' : 'Share this wheel'}
              </button>
            </div>
          </div>
        </div>
      </main>
      {winner && !spinning && <Confetti pieces={40} />}
    </div>
  );
}

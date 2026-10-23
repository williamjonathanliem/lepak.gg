import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../../lib/useReducedMotion';
import {
  LIVES,
  difficulty,
  newWaveState,
  onScreen,
  press,
  progress,
  release,
  tick,
  type Rules,
  type WaveState,
} from '../logic/waves';
import { SPACE, play } from './assets';

// Word mode: words ride enemy ships and meteors down toward your ship. Type one to zap it.
// The game runs on this device (in a time game everyone gets the same words); only the
// score, lives, and when you went out or reached the target are shared.

interface Shot {
  id: number;
  /** Where the zapped word was, 0..1 across and 0..1 down. */
  x: number;
  y: number;
  at: number;
}

export interface SpaceResult {
  score: number;
  lives: number;
  errors: number;
  correct: number;
  /** ms after the start when the last life went (0 = still alive). */
  outAt: number;
  /** Points game: ms after the start when the target was reached (0 = not yet). */
  wonAt: number;
}

export function Space({
  rules,
  startAt,
  now,
  locked,
  onChange,
}: {
  rules: Rules;
  /** Server time the game starts. */
  startAt: number;
  /** Server time now. */
  now: () => number;
  /** Time's up (or not started): stop playing. */
  locked: boolean;
  onChange: (r: SpaceResult) => void;
}) {
  const reduce = useReducedMotion();
  const [s, setS] = useState<WaveState>(newWaveState);
  const state = useRef(s);
  const [t, setT] = useState(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [hitAt, setHitAt] = useState(-1e9);
  const input = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const report = useRef(onChange);
  useEffect(() => {
    report.current = onChange;
  }, [onChange]);

  const apply = (next: WaveState, at: number) => {
    const prev = state.current;
    if (next === prev) return;
    state.current = next;
    setS(next);
    if (next.zapped.length > prev.zapped.length) {
      const id = next.zapped[next.zapped.length - 1]!;
      const w = next.words[id]!;
      setShots((list) => [
        ...list.filter((x) => at - x.at < 400),
        { id, x: w.x, y: progress(w, at), at },
      ]);
      play('laser', 0.35);
      setTimeout(() => play('boom', 0.3), 90);
    }
    if (next.lives < prev.lives) {
      setHitAt(at);
      play('hit', 0.6);
    } else if (next.errors > prev.errors) play('error', 0.25);
    if (
      next.score !== prev.score ||
      next.lives !== prev.lives ||
      next.errors !== prev.errors ||
      next.outAt !== prev.outAt ||
      next.wonAt !== prev.wonAt
    ) {
      const correct = next.zapped.reduce((n, id) => n + next.words[id]!.word.length, 0);
      report.current({
        score: next.score,
        lives: next.lives,
        errors: next.errors,
        correct,
        outAt: next.outAt ?? 0,
        wonAt: next.wonAt ?? 0,
      });
    }
  };

  // The game clock: every frame, move words on and take lives for any that got through.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const at = now() - startAt;
      setT(at);
      if (at >= 0 && !locked) apply(tick(rules, state.current, at), at);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rules, startAt, now, locked]);

  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [locked]);

  const key = (ch: string) => {
    if (locked || s.outAt !== null || s.wonAt !== null) return;
    const at = now() - startAt;
    if (at < 0) return;
    apply(press(rules, state.current, at, ch), at);
  };

  const visible = t >= 0 ? onScreen(s, t) : [];
  const out = s.outAt !== null;
  const won = s.wonAt !== null;
  /** 1..10, how hard it is right now (it climbs toward the target). */
  const level = 1 + Math.floor(difficulty(rules, s, Math.max(0, t)) * 9);
  const hurt = t - hitAt < 450;

  return (
    <section aria-label="Space" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-sm">
        <span className="flex items-center gap-1" aria-label={`${s.lives} of ${LIVES} lives`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <img
              key={i}
              src={SPACE.life}
              alt=""
              className={`h-5 ${i < s.lives ? '' : 'opacity-20 grayscale'}`}
            />
          ))}
        </span>
        <span>
          Level <b>{level}</b>
        </span>
        <span>
          Combo <b>{s.combo}</b>
        </span>
        <span className="text-base">
          <b>{s.score}</b>
          {rules.goal === 'points' ? ` / ${rules.targetScore}` : ''} pts
        </span>
      </div>

      <div
        className="relative h-[min(62vh,540px)] w-full overflow-hidden border-3 border-ink"
        style={{
          backgroundImage: `url(${SPACE.bg})`,
          backgroundSize: '256px 256px',
          backgroundPositionY: reduce ? 0 : `${(t / 40) % 256}px`,
        }}
        ref={field}
        onClick={() => input.current?.focus()}
        aria-hidden="true"
      >
        {visible.map((w) => {
          const p = Math.max(0, progress(w, t));
          const isTarget = s.target === w.id;
          return (
            <div
              key={w.id}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${w.x * 100}%`, top: `calc(${p} * (100% - 130px))` }}
            >
              <img
                src={SPACE.riders[w.sprite]}
                alt=""
                className="w-[clamp(34px,6vw,52px)] rotate-180"
                style={
                  w.sprite >= 4
                    ? { transform: `rotate(${(t / 8 + w.id * 40) % 360}deg)` }
                    : undefined
                }
              />
              <span
                className={`mt-1 border-2 px-1.5 font-mono text-[clamp(13px,1.9vw,17px)] leading-tight font-bold whitespace-nowrap ${isTarget ? 'border-[#4fd1e8] bg-ink' : 'border-ink bg-paper text-ink'}`}
              >
                {isTarget ? (
                  <>
                    <span className="text-[#4fd1e8]">{w.word.slice(0, s.typed)}</span>
                    <span className="text-paper">{w.word.slice(s.typed)}</span>
                  </>
                ) : (
                  w.word
                )}
              </span>
            </div>
          );
        })}

        {/* laser shots and hit bursts */}
        {shots
          .filter((x) => t - x.at < 300)
          .map((x) => {
            // From the ship's nose (bottom centre) to where the word was, in pixels.
            const sx = size.w / 2;
            const sy = size.h - 80;
            const tx = x.x * size.w;
            const ty = x.y * (size.h - 130) + 30;
            const length = Math.hypot(tx - sx, ty - sy);
            const angle = Math.atan2(tx - sx, sy - ty) * (180 / Math.PI);
            return (
              <div key={x.id}>
                <img
                  src={SPACE.laser}
                  alt=""
                  className="absolute bottom-[80px] left-1/2 w-2 origin-bottom"
                  style={{
                    height: length,
                    transform: `translateX(-50%) rotate(${angle}deg)`,
                    opacity: 1 - (t - x.at) / 300,
                  }}
                />
                <img
                  src={SPACE.burst}
                  alt=""
                  className="absolute w-14 -translate-x-1/2"
                  style={{
                    left: `${x.x * 100}%`,
                    top: `calc(${x.y} * (100% - 130px))`,
                    transform: `translateX(-50%) scale(${reduce ? 1 : 1 + (t - x.at) / 200})`,
                    opacity: 1 - (t - x.at) / 300,
                  }}
                />
              </div>
            );
          })}

        {/* your ship */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
          {!out && (
            <img
              src={SPACE.fire}
              alt=""
              className="absolute top-[44px] left-1/2 h-6 -translate-x-1/2"
            />
          )}
          <img
            src={SPACE.ship}
            alt=""
            className={`relative w-16 ${out ? 'opacity-30 grayscale' : ''}`}
          />
          {hurt && (
            <img src={SPACE.shield} alt="" className="absolute -inset-3 w-[88px] max-w-none" />
          )}
        </div>

        {t < 0 && (
          <p className="absolute inset-0 m-0 grid place-items-center text-[clamp(80px,22vw,160px)] font-black text-paper">
            {Math.ceil(-t / 1000)}
          </p>
        )}
        {won && (
          <p className="absolute inset-x-0 top-1/3 m-0 text-center text-[clamp(28px,6vw,48px)] font-black text-[#ffd23f] uppercase">
            Target reached!
          </p>
        )}
        {out && (
          <p className="absolute inset-x-0 top-1/3 m-0 text-center text-[clamp(28px,6vw,48px)] font-black text-paper uppercase">
            Out of lives
            <span className="block font-mono text-base font-normal normal-case">
              {s.score} points. Watch the others hold on.
            </span>
          </p>
        )}
      </div>

      <label className="sr-only" htmlFor="ketik-space-input">
        Type the words on screen to zap them. Backspace lets go of the word you picked.
      </label>
      <input
        id="ketik-space-input"
        ref={input}
        disabled={locked || out || won}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value=""
        placeholder={
          out || won ? '' : s.target !== null ? s.words[s.target]!.word : 'Type a word to zap it'
        }
        onChange={(e) => {
          for (const ch of e.target.value) if (/[a-z]/i.test(ch)) key(ch);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') {
            e.preventDefault();
            apply(release(state.current), now() - startAt);
          }
        }}
        className="h-12 w-full border-3 border-ink bg-paper px-4 font-mono text-lg"
      />
    </section>
  );
}

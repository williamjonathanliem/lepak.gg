import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Doodle } from '../../../components/Doodle';
import { KB, rejectMessage } from '../copy';
import { alivePlayers } from '../logic/game';
import type { Player } from '../logic/types';
import type { Room } from '../net/useRoom';
import { playerColor } from './avatar';
import { Bomb } from './Bomb';
import { Chat } from './Chat';
import { sfx } from './sound';
import { useNow } from './useNow';

// Full-screen game: warm dark table with players round the bomb, sidebar with scores and chat.
// Nothing on this screen scrolls except the chat list.

/** Shows `text` with the prompt letters lit up, so everyone can see the match. */
function Highlight({ text, prompt }: { text: string; prompt: string }) {
  const i = prompt ? text.toLowerCase().indexOf(prompt) : -1;
  if (i < 0) return <span className="text-paper/70">{text}</span>;
  return (
    <>
      <span className="text-paper/70">{text.slice(0, i)}</span>
      <span className="text-hot">{text.slice(i, i + prompt.length)}</span>
      <span className="text-paper/70">{text.slice(i + prompt.length)}</span>
    </>
  );
}

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function Game({ room }: { room: Room }) {
  const state = room.state!;
  const turn = state.turn;
  const now = useNow(room.now, true);
  const [sideOpen, setSideOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const compactView = useIsShort(tableRef, 300);

  const me = state.players.find((p) => p.id === room.selfId);
  const myTurn = !!turn && turn.playerId === room.selfId;
  const holder = state.players.find((p) => p.id === turn?.playerId);
  const seated = state.players.filter((p) => p.playing);
  const alive = alivePlayers(state).length;

  const total = turn ? turn.deadline - turn.startedAt : 1;
  const left = turn ? Math.max(0, turn.deadline - now) : 0;
  const fraction = Math.min(1, left / total);
  const danger = left < 3000;
  const secondsLeft = Math.ceil(left / 1000);

  // Tick in the last 3 seconds.
  useEffect(() => {
    if (turn && secondsLeft > 0 && secondsLeft <= 3) sfx.tick();
  }, [secondsLeft, turn]);

  const boom = state.event?.kind === 'boom' ? state.event : null;
  const holderIndex = seated.findIndex((p) => p.id === turn?.playerId);
  // First seat on the left, then round clockwise, so two players face each other across the bomb.
  const angleFor = (i: number) => (i / seated.length) * 2 * Math.PI + Math.PI;
  const round = Math.floor(state.turnCount / Math.max(1, alive)) + 1;

  return (
    <div className="on-dark flex h-full min-h-0 bg-night text-paper">
      {/* ---------- stage ---------- */}
      <section
        aria-label="Game"
        className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_50%_45%,#3a3029_0%,#1d1915_45%,var(--color-night)_80%)]"
      >
        {/* faint dot grid on top of the glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1.2px,transparent_1.2px)] bg-size-[24px_24px]"
        />

        {/* top strip */}
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-xs tracking-wide text-paper/60 uppercase">
          <span className="flex flex-wrap gap-x-3">
            <span>
              Round <b className="text-paper">{round}</b> · <b className="text-paper">{alive}</b>/
              {seated.length} alive
            </span>
            {turn && turn.solutions > 0 && (
              <span>
                <b className="text-paper">{compact(turn.solutions)}</b> words fit
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span aria-label="Match time" className="text-paper">
              {clock(now - state.matchStartedAt)}
            </span>
            <button
              type="button"
              aria-expanded={sideOpen}
              onClick={() => setSideOpen(true)}
              className="min-h-10 cursor-pointer rounded-none border border-paper/40 bg-transparent px-3 font-mono text-xs font-bold text-paper uppercase lg:hidden"
            >
              Chat
            </button>
          </div>
        </div>

        {/* table: the full circle, or a compact bar when there's little height (phone keyboard open) */}
        <div ref={tableRef} className="relative min-h-0 flex-1">
          {compactView ? (
            <CompactTable
              room={room}
              fraction={fraction}
              danger={danger}
              secondsLeft={secondsLeft}
              shakeKey={boom ? state.seq : null}
            />
          ) : (
            <div
              key={boom ? state.seq : 'calm'}
              className={`absolute inset-0 [container-type:size] ${boom ? 'animate-shake' : ''}`}
            >
              <div className="absolute top-1/2 left-1/2 size-[min(100cqw,100cqh)] -translate-x-1/2 -translate-y-1/2">
                {/* middle: the letters to match, then the bomb, then what's being typed */}
                <div className="absolute top-1/2 left-1/2 z-10 flex w-[52%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[2.5cqmin]">
                  <PromptCard prompt={turn?.prompt ?? ''} solutions={turn?.solutions ?? 0} />
                  <div className="relative size-[22cqmin]">
                    <Arrow index={holderIndex} count={seated.length} />
                    <TimerRing fraction={fraction} danger={danger && !!turn} />
                    <div className="absolute inset-[16%]">
                      <Bomb fraction={fraction} danger={danger && !!turn} />
                    </div>
                  </div>
                  <TypingTiles
                    text={holder ? (room.typing[holder.id] ?? '') : ''}
                    prompt={turn?.prompt ?? ''}
                    turnKey={`${turn?.playerId}-${turn?.startedAt}`}
                  />
                </div>

                {/* boom! */}
                {boom && (
                  <div
                    key={state.seq}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
                  >
                    <div className="flex size-[34cqmin] animate-burst items-center justify-center bg-hot font-sans text-[8cqmin] font-black text-ink [clip-path:polygon(50%_0,61%_30%,95%_20%,72%_47%,100%_70%,66%_70%,62%_100%,45%_74%,15%_96%,24%_64%,0_45%,30%_38%,12%_8%,42%_25%)]">
                      BOOM
                    </div>
                  </div>
                )}

                {/* seats */}
                <ul className="m-0 list-none p-0">
                  {seated.map((p, i) => {
                    const a = angleFor(i);
                    return (
                      <li
                        key={p.id}
                        className="absolute w-[clamp(90px,24cqmin,190px)] -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${50 + 37 * Math.cos(a)}%`,
                          top: `${50 + 36 * Math.sin(a)}%`,
                        }}
                      >
                        <Seat
                          player={p}
                          maxLives={state.settings.lives}
                          active={p.id === turn?.playerId}
                          host={p.id === state.hostId}
                          you={p.id === room.selfId}
                          room={room}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* screen reader status */}
        <p className="sr-only" aria-live="polite">
          {myTurn
            ? `${KB.yourTurn} ${turn?.prompt.toUpperCase()}`
            : holder
              ? KB.theirTurn(holder.nickname)
              : ''}
        </p>

        {/* bottom bar: input on your turn, a status line otherwise */}
        <div className="relative border-t border-paper/15 bg-night/80 px-4 py-3">
          {myTurn && me?.alive ? (
            <WordInput
              key={`${turn?.playerId}-${turn?.startedAt}`}
              room={room}
              prompt={turn?.prompt ?? ''}
            />
          ) : (
            <p className="m-0 flex min-h-14 items-center justify-center text-center text-[clamp(16px,2vw,22px)]">
              {!me?.playing ? (
                KB.watchingNote
              ) : !me.alive ? (
                'You’re out. Cheer them on.'
              ) : holder ? (
                <span>
                  <b style={{ color: playerColor(holder) }}>{holder.nickname}</b> is up.
                </span>
              ) : (
                ''
              )}
            </p>
          )}
        </div>
      </section>

      {/* ---------- sidebar: scores + chat ---------- */}
      <aside
        aria-label="Scores and chat"
        className={`flex min-h-0 w-[min(340px,100vw)] flex-col border-l border-paper/15 bg-night max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:shadow-[-12px_0_0_rgb(0_0_0/0.4)] ${sideOpen ? '' : 'max-lg:hidden'}`}
      >
        <div className="flex items-center justify-between px-3 pt-3 lg:hidden">
          <span className="font-mono text-xs text-paper/60 uppercase">Scores + chat</span>
          <button
            type="button"
            onClick={() => setSideOpen(false)}
            className="min-h-10 cursor-pointer border-0 bg-transparent px-2 font-mono text-sm text-paper underline"
          >
            Close
          </button>
        </div>
        <Scoreboard room={room} />
        <UsedWords words={state.usedWords} />
        <Chat room={room} className="flex-1 border-t border-paper/15" />
      </aside>
    </div>
  );
}

// ---------- middle of the table ----------

/** The letters every word must contain, on a card, with how many words fit. */
function PromptCard({ prompt, solutions }: { prompt: string; solutions: number }) {
  return (
    <div
      key={prompt}
      className="relative animate-pop border-3 border-paper/80 bg-ink px-[3cqmin] py-[1.2cqmin] shadow-[5px_5px_0_rgb(0_0_0/0.45)]"
    >
      <span className="sr-only">Letters: </span>
      <span className="font-sans text-[clamp(28px,9cqmin,80px)] leading-none font-black tracking-wide text-paper uppercase">
        {prompt}
      </span>
      {solutions > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1 bottom-0.5 font-mono text-[clamp(9px,1.8cqmin,13px)] text-paper/50"
        >
          {compact(solutions)}
        </span>
      )}
    </div>
  );
}

/** What the player with the bomb is typing, one tile per letter. Letters that make the prompt are outlined. */
function TypingTiles({ text, prompt, turnKey }: { text: string; prompt: string; turnKey: string }) {
  const at = prompt ? text.toLowerCase().indexOf(prompt) : -1;
  const letters = [...text.slice(0, 30)];
  // One row: tiles shrink as the word gets long.
  const size = `clamp(14px, ${Math.min(5.6, 56 / Math.max(1, letters.length))}cqmin, 46px)`;
  return (
    <div
      key={turnKey}
      aria-hidden="true"
      className="relative z-10 flex min-h-[clamp(30px,7cqmin,56px)] w-[110%] justify-center gap-[0.5cqmin]"
    >
      {letters.map((ch, i) => {
        const hit = at >= 0 && i >= at && i < at + prompt.length;
        return (
          <span
            key={i}
            style={{ width: size, height: size, fontSize: `calc(${size} * 0.66)` }}
            className={`flex shrink-0 animate-pop items-center justify-center border-2 font-sans leading-none font-black uppercase ${
              hit ? 'border-hot bg-hot/15 text-paper' : 'border-paper/25 bg-ink text-paper/90'
            }`}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

/** Ring round the bomb that empties as the fuse burns. */
function TimerRing({ fraction, danger }: { fraction: number; danger: boolean }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 -rotate-90">
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
        stroke={danger ? 'var(--color-hot)' : 'rgb(255 255 255 / 0.55)'}
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - fraction}
        className="transition-[stroke-dashoffset,stroke] duration-150 ease-linear"
      />
    </svg>
  );
}

/**
 * Arrow from the bomb to whoever holds it. Turns the short way round when the bomb moves,
 * so it never spins all the way back from the last seat to the first.
 */
function Arrow({ index, count }: { index: number; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const target = index >= 0 ? (index / Math.max(1, count)) * 360 + 180 : 180;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = last.current;
    let to = target;
    if (from !== null) {
      const diff = ((((target - from) % 360) + 540) % 360) - 180;
      to = from + diff;
    }
    last.current = to;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.animate([{ transform: `rotate(${from ?? to}deg)` }, { transform: `rotate(${to}deg)` }], {
      duration: reduce || from === null ? 0 : 380,
      easing: 'cubic-bezier(.2,.9,.3,1.2)',
      fill: 'forwards',
    });
  }, [target]);

  return (
    <div ref={ref} aria-hidden="true" className="absolute top-1/2 left-1/2 h-0 w-0">
      <div className="absolute top-0 left-[12.5cqmin] flex -translate-y-1/2 items-center drop-shadow-[0_2px_0_rgb(0_0_0/0.4)]">
        <div className="h-[clamp(5px,1.3cqmin,10px)] w-[7cqmin] rounded-l-full bg-paper/85" />
        <div className="h-0 w-0 border-y-[clamp(9px,2.4cqmin,18px)] border-l-[clamp(14px,3.6cqmin,28px)] border-y-transparent border-l-paper/85" />
      </div>
    </div>
  );
}

// ---------- seat ----------

interface SeatProps {
  player: Player;
  maxLives: number;
  active: boolean;
  host: boolean;
  you: boolean;
  room: Room;
}

function Seat({ player, maxLives, active, host, you, room }: SeatProps) {
  const event = room.state!.event;
  const lastWord = event?.kind === 'word' && event.playerId === player.id ? event.word : null;
  const bounced = event?.kind === 'reject' && event.playerId === player.id;
  const out = !player.alive;
  const color = playerColor(player);

  return (
    <div className={`flex flex-col items-center text-center ${bounced ? 'animate-shake' : ''}`}>
      <span
        className={`mb-1.5 flex max-w-full items-center gap-1 text-[clamp(13px,3.2cqmin,22px)] font-black ${out ? 'text-paper/40 line-through' : ''}`}
      >
        {host && (
          <span aria-label="host" className="text-[0.8em]">
            ♛
          </span>
        )}
        <span className="truncate">{player.nickname}</span>
        {you && <span className="text-[0.7em] font-normal text-paper/50">(you)</span>}
      </span>

      <div className="relative">
        {/* hearts sit on top of the avatar's top edge */}
        <span
          className="absolute -top-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-px text-hot"
          aria-label={`${player.lives} lives`}
        >
          {Array.from({ length: maxLives }, (_, i) => (
            <Doodle
              key={i}
              name="heart"
              stroke={5}
              filled={i < player.lives}
              className={`size-[clamp(12px,3cqmin,20px)] drop-shadow-[0_1px_0_rgb(0_0_0/0.6)] ${i < player.lives ? '' : 'opacity-50'}`}
            />
          ))}
        </span>
        <div
          className={`flex size-[clamp(48px,12cqmin,96px)] items-center justify-center border-3 font-sans text-[clamp(22px,6cqmin,48px)] font-black text-ink uppercase transition-transform duration-200 ${
            active
              ? 'scale-110 border-paper shadow-[0_0_0_4px_var(--color-hot),6px_6px_0_4px_rgb(0_0_0/0.45)]'
              : 'border-ink shadow-[5px_5px_0_rgb(0_0_0/0.45)]'
          } ${out ? 'opacity-30 grayscale' : ''}`}
          style={{ background: color }}
        >
          {out ? '✕' : (player.emoji ?? player.nickname.slice(0, 1))}
        </div>
        {/* +1 floats up when their word lands */}
        {lastWord && (
          <span
            key={room.state!.seq}
            aria-hidden="true"
            className="pointer-events-none absolute -top-4 -right-5 animate-float-up font-mono text-[clamp(14px,3.4cqmin,24px)] font-black text-[#7ee081]"
          >
            +1
          </span>
        )}
        {/* hot streak badge from 3 words in a row */}
        {player.streak >= 3 && !out && (
          <span
            aria-label={`${player.streak} in a row`}
            className="absolute -bottom-2 -left-3 bg-hot px-1 font-mono text-[clamp(10px,2.4cqmin,14px)] font-black text-ink"
          >
            {player.streak}x
          </span>
        )}
        {!player.connected && !out && (
          <span className="absolute -right-2 -bottom-2 bg-paper px-1 font-mono text-[10px] font-bold text-ink">
            {KB.away}
          </span>
        )}
      </div>

      <span
        className="mt-2 min-h-[1.3em] w-[180%] truncate font-sans text-[clamp(14px,3.8cqmin,30px)] font-black tracking-wide uppercase"
        aria-hidden="true"
      >
        {lastWord ? (
          <span key={room.state!.seq} className="inline-block animate-pop text-paper">
            {lastWord}
          </span>
        ) : (
          ''
        )}
      </span>
    </div>
  );
}

// ---------- sidebar parts ----------

function Scoreboard({ room }: { room: Room }) {
  const state = room.state!;
  const rows = state.players
    .filter((p) => p.playing)
    .sort((a, b) => Number(b.alive) - Number(a.alive) || b.words - a.words);
  return (
    <table className="w-full border-collapse font-mono text-xs">
      <caption className="px-3 pt-3 pb-1 text-left text-paper/60 uppercase">Scores</caption>
      <thead>
        <tr className="text-paper/50">
          <th className="px-3 py-1.5 text-left font-normal">PLAYER</th>
          <th className="px-1 py-1.5 font-normal">LIVES</th>
          <th className="px-1 py-1.5 font-normal">WORDS</th>
          <th className="px-3 py-1.5 text-right font-normal">LONGEST</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr
            key={p.id}
            className={`${p.id === state.turn?.playerId ? 'bg-paper/10' : ''} ${p.alive ? '' : 'text-paper/40 line-through'}`}
          >
            <td className="max-w-32 px-3 py-2">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block size-3 shrink-0"
                  style={{ background: playerColor(p) }}
                />
                <span className="truncate font-bold">{p.nickname}</span>
              </span>
            </td>
            <td className="px-1 py-2 text-center text-hot">{'♥'.repeat(p.lives) || '-'}</td>
            <td className="px-1 py-2 text-center">{p.words}</td>
            <td className="px-3 py-2 text-right">{p.longest.length || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsedWords({ words }: { words: readonly string[] }) {
  const recent = words.slice(-10).reverse();
  return (
    <div className="border-t border-paper/15 px-3 py-2.5">
      <p className="m-0 mb-2 font-mono text-xs text-paper/60">
        {KB.usedCount(words.length).toUpperCase()}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
        {recent.map((w) => (
          <li key={w} className="bg-paper/10 px-1.5 py-0.5 font-mono text-xs uppercase">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- word input (only shown on your turn) ----------

function WordInput({ room, prompt }: { room: Room; prompt: string }) {
  // The parent remounts this per turn (key), so the box starts empty each time.
  const [word, setWord] = useState('');
  const [dismissedSeq, setDismissedSeq] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const event = room.state!.event;
  const seq = room.state!.seq;

  // My word bounced: say why, until I start typing again.
  const bounced = event?.kind === 'reject' && event.playerId === room.selfId && seq > dismissedSeq;
  const feedback = bounced ? rejectMessage(event.reason, prompt) : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (bounced) inputRef.current?.select();
  }, [bounced, seq]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;
    room.submit(word);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-2xl flex-col gap-1">
      <div className="flex items-center gap-3">
        <label htmlFor="kb-word" className="sr-only">
          {`${KB.yourTurn} ${prompt.toUpperCase()}`}
        </label>
        <input
          id="kb-word"
          ref={inputRef}
          value={word}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={40}
          placeholder={`Your turn: ${prompt.toUpperCase()}`}
          aria-invalid={feedback ? true : undefined}
          aria-describedby="kb-feedback"
          onChange={(e) => {
            const v = e.target.value.replace(/[^a-zA-Z]/g, '');
            setWord(v);
            setDismissedSeq(seq);
            room.setTyping(v);
          }}
          className={`h-14 min-w-0 flex-1 border-3 border-hot bg-paper px-4 font-mono text-2xl font-bold text-ink uppercase placeholder:text-base placeholder:font-normal placeholder:normal-case ${
            feedback ? 'animate-shake' : ''
          }`}
        />
        <button
          type="submit"
          className="h-14 cursor-pointer border-3 border-hot bg-hot px-5 font-mono font-bold text-ink uppercase"
        >
          {KB.send}
        </button>
      </div>
      <p
        id="kb-feedback"
        role="alert"
        className="m-0 min-h-5 text-center font-mono text-sm font-bold text-hot"
      >
        {feedback ? `! ${feedback}` : ''}
      </p>
    </form>
  );
}

// ---------- compact table (little height, e.g. phone keyboard open) ----------

/** True while the element is shorter than `limit` px. Watches resizes, e.g. a keyboard opening. */
function useIsShort(ref: React.RefObject<HTMLElement | null>, limit: number): boolean {
  const [short, setShort] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setShort(entry.contentRect.height < limit);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, limit]);
  return short;
}

interface CompactTableProps {
  room: Room;
  fraction: number;
  danger: boolean;
  secondsLeft: number;
  shakeKey: number | null;
}

/** One-bar version of the table: bomb + prompt, who's up and their typing, then everyone in a row. */
function CompactTable({ room, fraction, danger, secondsLeft, shakeKey }: CompactTableProps) {
  const state = room.state!;
  const turn = state.turn;
  const holder = state.players.find((p) => p.id === turn?.playerId);
  const seated = state.players.filter((p) => p.playing);

  return (
    <div
      key={shakeKey ?? 'calm'}
      className={`absolute inset-0 flex flex-col justify-center gap-2 overflow-hidden px-4 ${shakeKey ? 'animate-shake' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative w-16 shrink-0">
          <Bomb fraction={fraction} danger={danger && !!turn} />
        </div>
        <span className="shrink-0 border-2 border-paper/30 bg-ink px-2 py-1 font-sans text-2xl leading-none font-black text-paper uppercase">
          <span className="sr-only">Letters: </span>
          {turn?.prompt}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-baseline gap-2 font-mono text-xs uppercase">
            {holder && (
              <b className="truncate" style={{ color: playerColor(holder) }}>
                {holder.nickname}
              </b>
            )}
            <span className={danger ? 'text-hot' : 'text-paper/60'}>{secondsLeft}s</span>
          </p>
          <p
            aria-hidden="true"
            className="m-0 truncate font-sans text-2xl leading-tight font-black tracking-wide uppercase"
          >
            {holder ? (
              <Highlight text={room.typing[holder.id] ?? ''} prompt={turn?.prompt ?? ''} />
            ) : (
              ''
            )}
            {'​'}
          </p>
        </div>
      </div>
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1">
        {seated.map((p) => {
          const active = p.id === turn?.playerId;
          return (
            <li
              key={p.id}
              className={`flex shrink-0 flex-col items-center ${p.alive ? '' : 'opacity-35'}`}
            >
              <span
                className={`flex size-9 items-center justify-center border-2 text-base font-black text-ink uppercase ${active ? 'border-paper shadow-[0_0_0_3px_var(--color-hot)]' : 'border-ink'}`}
                style={{ background: playerColor(p) }}
                aria-label={`${p.nickname}${active ? ', holding the bomb' : ''}, ${p.lives} lives`}
              >
                {p.alive ? (p.emoji ?? p.nickname.slice(0, 1)) : '✕'}
              </span>
              <span aria-hidden="true" className="mt-0.5 text-[10px] leading-none text-hot">
                {'♥'.repeat(p.lives)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

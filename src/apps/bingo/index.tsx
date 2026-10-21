import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { Confetti } from '../../components/Confetti';
import { firebaseEnabled } from '../../lib/firebase';
import { readStorage, writeStorage } from '../../lib/storage';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { useGoneFor } from '../../lib/useGoneFor';
import { NicknameGate } from '../katabomb/ui/NicknameGate';
import {
  FREE,
  MIN_WORDS,
  NUMBERS,
  callLabel,
  makeCard,
  nextCall,
  parseWords,
  winningLine,
} from './logic/bingo';
import { openBingo, type BingoRoom, type Game } from './net/bingoRoom';
import { AppHeader } from '../../components/AppHeader';

// Bingo: /bingo (home), /bingo/host/:code (caller screen), /bingo/r/:code (player card).

const ACCENT = '#ffd23f';

export default function Bingo() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Bingo', to: '/bingo', accent: ACCENT }} />
      <Routes>
        <Route index element={<Home />} />
        <Route path="host/:code" element={<CodeRoute screen="host" />} />
        <Route path="r/:code" element={<CodeRoute screen="player" />} />
      </Routes>
    </div>
  );
}

function CodeRoute({ screen }: { screen: 'host' | 'player' }) {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) return <Navigate to="/bingo" replace />;
  return screen === 'host' ? (
    <Host code={code} />
  ) : (
    <NicknameGate>{(nick) => <Player code={code} nick={nick} />}</NicknameGate>
  );
}

/** Opens the room and keeps the game in state. */
function useBingo(code: string) {
  const [room, setRoom] = useState<BingoRoom | null>(null);
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let r: BingoRoom | null = null;
    let closed = false;
    openBingo(code)
      .then((opened) => {
        if (closed) return opened.close();
        r = opened;
        setRoom(opened);
        opened.onGame(setGame, () => setFailed(true));
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      r?.close();
    };
  }, [code]);
  return { room, game, failed };
}

// ---------- home ----------

function Home() {
  const navigate = useNavigate();
  // AI Notes can hand over key terms for a revision bingo.
  const handed = (useLocation().state as { words?: string[] } | null)?.words;
  const [mode, setMode] = useState<'numbers' | 'words'>(handed?.length ? 'words' : 'numbers');
  const [words, setWords] = useState(handed?.join('\n') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = parseWords(words);

  function host() {
    if (mode === 'words' && list.length < MIN_WORDS) {
      return setError(`Add at least ${MIN_WORDS} different words (you have ${list.length}).`);
    }
    navigate(`/bingo/host/${generateRoomCode()}`, {
      state: { items: mode === 'numbers' ? NUMBERS : list, numbers: mode === 'numbers' },
    });
  }

  function join(e: FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(code)) return setError('Codes are 4 letters or numbers.');
    navigate(`/bingo/r/${normalizeRoomCode(code)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Bingo · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Bingo.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Run it on the projector, everyone plays on their phone. Use classic numbers or your own
          words (great for revising vocab).
        </p>
      </div>
      {!firebaseEnabled && (
        <p className="m-0 font-mono text-sm">
          Bingo needs the Lepak server, which this copy is not set up for.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
        <section
          className="flex flex-col gap-3 border-3 border-ink p-5 shadow-hard"
          style={{ background: ACCENT }}
        >
          <h2 className="m-0 text-2xl font-black uppercase">Host a game</h2>
          <div role="radiogroup" aria-label="What to call" className="flex gap-2">
            {(['numbers', 'words'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold uppercase ${mode === m ? 'bg-ink text-paper' : 'bg-paper'}`}
              >
                {m === 'numbers' ? 'Numbers 1-75' : 'My own words'}
              </button>
            ))}
          </div>
          {mode === 'words' && (
            <>
              <label htmlFor="b-words" className="font-mono text-xs uppercase">
                One per line or comma ({list.length}/{MIN_WORDS} minimum)
              </label>
              <textarea
                id="b-words"
                value={words}
                onChange={(e) => {
                  setWords(e.target.value);
                  setError(null);
                }}
                placeholder={'mitochondria\nnucleus\nribosome\n...'}
                className="min-h-40 border-3 border-ink bg-paper p-3 font-mono text-sm"
              />
            </>
          )}
          <button
            type="button"
            disabled={!firebaseEnabled}
            onClick={host}
            className="push mt-auto h-14 self-start cursor-pointer border-3 border-ink bg-ink px-6 font-mono font-bold text-paper uppercase shadow-hard disabled:opacity-40"
          >
            Start hosting
          </button>
        </section>
        <form noValidate onSubmit={join} className="flex flex-col gap-3 border-3 border-ink p-5">
          <h2 className="m-0 text-2xl font-black uppercase">Join</h2>
          <label htmlFor="b-code" className="font-mono text-xs uppercase">
            Code on the screen
          </label>
          <div className="flex">
            <input
              id="b-code"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="KJRW"
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              className="h-14 w-32 border-3 border-ink bg-paper px-3 font-mono text-xl tracking-[0.25em] uppercase"
            />
            <button
              type="submit"
              className="h-14 cursor-pointer border-3 border-l-0 border-ink bg-ink px-5 font-mono font-bold text-paper uppercase"
            >
              Join
            </button>
          </div>
        </form>
      </div>
      <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
        {error ? `! ${error}` : ''}
      </p>
    </main>
  );
}

// ---------- host (caller) ----------

function Host({ code }: { code: string }) {
  const setup = useLocation().state as { items?: string[]; numbers?: boolean } | null;
  const { room, game, failed } = useBingo(code);
  const [players, setPlayers] = useState<Record<string, string>>({});
  const [rejected, setRejected] = useState<string | null>(null);
  const created = useRef(false);

  // Create the game the first time (when arriving from "Start hosting").
  useEffect(() => {
    if (!room || game !== null || created.current || !setup?.items) return;
    created.current = true;
    void room.saveGame({
      hostId: room.selfId,
      numbers: !!setup.numbers,
      items: setup.items,
      called: [],
      winners: [],
    });
  }, [room, game, setup]);

  // Players watch this: if the host's screen goes away, the game ends for everyone.
  const isMine = !!room && !!game && game.hostId === room.selfId;
  useEffect(() => {
    if (isMine) room!.markHostHere();
  }, [isMine, room]);

  // The claim checker below reads the latest game without re-subscribing.
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Check every claim by rebuilding that player's card. Real wins go on the winners list.
  useEffect(() => {
    if (!room) return;
    const a = room.onPlayers(setPlayers);
    const b = room.onClaims((claims) => {
      const g = gameRef.current;
      if (!g || g.hostId !== room.selfId) return;
      let winners = g.winners;
      for (const c of claims) {
        const card = makeCard(g.items, `${code}:${c.uid}`);
        const ok = !!winningLine(card, new Set(g.called));
        if (ok && !winners.some((w) => w.uid === c.uid)) {
          winners = [...winners, { uid: c.uid, nick: c.nick }];
        } else if (!ok) {
          setRejected(c.nick);
          setTimeout(() => setRejected(null), 3000);
        }
        void room.clearClaim(c.uid);
      }
      if (winners !== g.winners) void room.saveGame({ ...g, winners });
    });
    return () => {
      a();
      b();
    };
  }, [room, code]);

  if (failed)
    return (
      <p className="px-gutter py-16 font-mono">
        Could not open this game. Check your internet and try again.
      </p>
    );
  if (game === undefined || !room) return <p className="px-gutter py-16 font-mono">Loading...</p>;
  if (game === null)
    return (
      <p className="px-gutter py-16 font-mono">
        No game with code {code}.{' '}
        <Link to="/bingo" className="underline">
          Start one
        </Link>
        .
      </p>
    );
  if (game.hostId !== room.selfId) return <Navigate to={`/bingo/r/${code}`} replace />;
  if (game.closed) return <Ended text="You ended this game." />;

  const last = game.called.at(-1);
  const calledSet = new Set(game.called);
  const callNext = () => {
    const next = nextCall(game.items, game.called, Math.random);
    if (next) void room.saveGame({ ...game, called: [...game.called, next] });
  };
  const link = `${window.location.origin}/bingo/r/${code}`;

  return (
    <main className="grid flex-1 gap-[3px] bg-ink lg:grid-cols-[2fr_1fr]">
      <title>{`Bingo ${code} · Lepak.gg`}</title>
      {game.winners.length > 0 && <Confetti key={game.winners.length} />}
      <section className="flex flex-col items-center justify-center gap-6 bg-paper px-gutter py-8 text-center">
        <p className="m-0 font-mono text-sm uppercase">
          Join at <b>{link.replace(/^https?:\/\//, '')}</b> · code{' '}
          <b className="text-2xl tracking-[0.2em]">{code}</b>
        </p>
        <div aria-live="assertive" className="flex min-h-[30vh] items-center justify-center">
          {last ? (
            <span
              key={last}
              className="animate-pop border-3 border-ink px-[0.3em] text-[clamp(56px,14vw,200px)] leading-none font-black uppercase shadow-hard"
              style={{ background: ACCENT }}
            >
              {callLabel(last, game.numbers)}
            </span>
          ) : (
            <span className="text-3xl font-black text-mute">Press "Call next" to start</span>
          )}
        </div>
        <button
          type="button"
          onClick={callNext}
          disabled={game.called.length >= game.items.length}
          className="push h-16 cursor-pointer border-3 border-ink bg-ink px-10 font-mono text-xl font-bold text-paper uppercase shadow-hard disabled:opacity-40"
        >
          Call next
        </button>
        <button
          type="button"
          onClick={() => void room.saveGame({ ...game, closed: true })}
          className="min-h-11 cursor-pointer border-0 bg-transparent font-mono text-sm underline"
        >
          End game for everyone
        </button>
        <p className="m-0 font-mono text-sm">
          {game.called.length} / {game.items.length} called · {Object.keys(players).length} playing
        </p>
        {rejected && (
          <p role="status" className="m-0 border-3 border-ink bg-hot px-3 py-1 font-mono font-bold">
            {rejected} said Bingo... but no full line yet!
          </p>
        )}
      </section>
      <aside className="flex flex-col gap-4 overflow-y-auto bg-paper px-gutter py-6">
        <h2 className="m-0 text-xl font-black uppercase">Winners</h2>
        {game.winners.length === 0 ? (
          <p className="m-0 font-mono text-sm text-mute">No one yet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {game.winners.map((w, i) => (
              <li
                key={w.uid}
                className="border-3 border-ink px-3 py-2 font-black"
                style={{ background: i === 0 ? ACCENT : undefined }}
              >
                {i + 1}. {w.nick}
              </li>
            ))}
          </ol>
        )}
        <h2 className="m-0 text-xl font-black uppercase">Called</h2>
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
          {game.items.map((item) => (
            <li
              key={item}
              className={`border-2 border-ink px-1.5 py-0.5 font-mono text-xs ${calledSet.has(item) ? 'bg-ink text-paper' : 'text-mute'}`}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

// ---------- player ----------

function Player({ code, nick }: { code: string; nick: string }) {
  const { room, game, failed } = useBingo(code);
  const dabKey = `lepak.bingo.${code}`;
  const [dabbed, setDabbed] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(readStorage(dabKey) ?? '[]') as number[]);
    } catch {
      return new Set();
    }
  });
  const [claimed, setClaimed] = useState(false);
  const [hostHere, setHostHere] = useState(true);
  const hostGone = useGoneFor(hostHere || !game);

  useEffect(() => {
    if (!room) return;
    void room.join(nick);
    return room.onHostHere(setHostHere);
  }, [room, nick]);

  if (failed)
    return (
      <p className="px-gutter py-16 font-mono">
        Could not open this game. Check your internet and try again.
      </p>
    );
  if (game === undefined || !room) return <p className="px-gutter py-16 font-mono">Joining...</p>;
  if (game === null)
    return (
      <p className="px-gutter py-16 font-mono">
        No game with code {code} yet. Check the code on the screen.
      </p>
    );

  if (game.closed || hostGone) return <Ended text="The host ended the game. Thanks for playing!" />;

  const card = makeCard(game.items, `${code}:${room.selfId}`);
  const called = new Set(game.called);
  const line = winningLine(card, called);
  const won = game.winners.some((w) => w.uid === room.selfId);
  const last = game.called.at(-1);

  const toggle = (i: number) => {
    const next = new Set(dabbed);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDabbed(next);
    writeStorage(dabKey, JSON.stringify([...next]));
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-gutter py-5">
      <title>{`Bingo ${code} · Lepak.gg`}</title>
      {won && <Confetti />}
      <div className="flex items-center justify-between font-mono text-sm">
        <span>
          {nick} · code <b>{code}</b>
        </span>
        <span>{game.called.length} called</span>
      </div>
      <p
        aria-live="polite"
        className="m-0 flex min-h-16 items-center justify-center border-3 border-ink text-3xl font-black uppercase"
        style={{ background: last ? ACCENT : undefined }}
      >
        {last ? callLabel(last, game.numbers) : 'Waiting for the first call...'}
      </p>
      {game.numbers && (
        <div aria-hidden="true" className="grid grid-cols-5 text-center text-2xl font-black">
          {'BINGO'.split('').map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
      <div role="grid" aria-label="Your bingo card" className="grid grid-cols-5 gap-1.5">
        {card.map((cell, i) => {
          const free = cell === FREE;
          const isCalled = free || called.has(cell);
          const on = free || dabbed.has(i);
          const inLine = line?.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-pressed={on}
              disabled={free}
              onClick={() => toggle(i)}
              className={`flex aspect-square cursor-pointer items-center justify-center border-3 border-ink p-0.5 text-center font-black break-words uppercase ${
                game.numbers ? 'text-xl' : 'text-[clamp(9px,2.6vw,13px)] leading-tight'
              } ${on ? 'bg-ink text-paper' : 'bg-paper'} ${inLine && on ? 'outline-4 outline-offset-[-7px] outline-[#ffd23f]' : ''} ${!isCalled && on ? 'opacity-60' : ''}`}
            >
              {cell}
            </button>
          );
        })}
      </div>
      <p className="m-0 font-mono text-xs text-mute">
        Tap a square when its word or number is called.
      </p>
      {won ? (
        <p
          className="m-0 border-3 border-ink p-4 text-center text-3xl font-black uppercase"
          style={{ background: ACCENT }}
        >
          You got Bingo! 🎉
        </p>
      ) : (
        <button
          type="button"
          disabled={claimed && !line}
          onClick={() => {
            setClaimed(true);
            void room.claim(nick);
            setTimeout(() => setClaimed(false), 4000);
          }}
          className="push h-16 cursor-pointer border-3 border-ink font-mono text-2xl font-black uppercase shadow-hard disabled:opacity-40"
          style={{ background: line ? ACCENT : undefined }}
        >
          {claimed ? 'Checking...' : 'Bingo!'}
        </button>
      )}
      {game.winners.length > 0 && !won && (
        <p className="m-0 font-mono text-sm">
          Winners so far: {game.winners.map((w) => w.nick).join(', ')}
        </p>
      )}
    </main>
  );
}

function Ended({ text }: { text: string }) {
  return (
    <main className="flex flex-1 flex-col items-start gap-6 px-gutter py-16">
      <p role="status" className="m-0 font-mono text-lg">
        {text}
      </p>
      <Link to="/bingo" className="inline-flex min-h-11 items-center font-mono underline">
        Back to Bingo
      </Link>
    </main>
  );
}

import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { Input, InputError } from '../../components/Input';
import { firebaseEnabled } from '../../lib/firebase';
import { SITE } from '../../lib/site';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';

// Whiteboard: /whiteboard (home), /whiteboard/solo, /whiteboard/r/:code (shared, live).
// The drawing library is big, so it only loads once you open a board.
const Board = lazy(() => import('./ui/Board').then((m) => ({ default: m.Board })));

function Loading() {
  return (
    <p role="status" className="px-gutter py-16 font-mono">
      Loading the board...
    </p>
  );
}

export default function WhiteboardApp() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route
        path="solo"
        element={
          <Suspense fallback={<Loading />}>
            <Board code={null} />
          </Suspense>
        }
      />
      <Route path="r/:code" element={<SharedBoard />} />
    </Routes>
  );
}

function SharedBoard() {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) return <Navigate to="/whiteboard" replace />;
  if (code !== raw) return <Navigate to={`/whiteboard/r/${code}`} replace />;
  return (
    <Suspense fallback={<Loading />}>
      <Board key={code} code={code} />
    </Suspense>
  );
}

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function join(e: FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(code)) return setError('4 letters or numbers, like KJRW.');
    navigate(`/whiteboard/r/${normalizeRoomCode(code)}`);
  }

  return (
    <div className="min-h-dvh">
      <title>Whiteboard · Lepak.gg</title>
      <header className="flex h-12 items-stretch border-b-3 border-ink">
        <Link
          to="/hub"
          className="flex items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-ink" />
          {SITE.wordmark}
        </Link>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-gutter py-[clamp(32px,6vw,64px)]">
        <div>
          <h1 className="heading-lg m-0">Whiteboard.</h1>
          <p className="mt-3 mb-0 max-w-xl text-lg text-mute">
            Sketch out a group project, solve a maths question together, or just doodle. Share the
            code and everyone draws on the same board, live.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
          <section className="flex flex-col gap-3 border-3 border-ink bg-[#4fd1e8] p-5 shadow-hard">
            <h2 className="m-0 text-2xl font-black uppercase">Shared board</h2>
            <p className="m-0 text-sm">Get a code. Anyone with it can draw with you.</p>
            <Button
              disabled={!firebaseEnabled}
              onClick={() => navigate(`/whiteboard/r/${generateRoomCode()}`)}
              className="mt-auto h-14 self-start px-6 disabled:opacity-40"
            >
              New shared board
            </Button>
          </section>
          <form
            noValidate
            onSubmit={join}
            className="flex flex-col gap-2 border-3 border-ink bg-paper p-5"
          >
            <h2 className="m-0 text-2xl font-black uppercase">Join</h2>
            <label htmlFor="wb-code" className="font-mono text-xs uppercase">
              Board code
            </label>
            <div className="flex flex-wrap gap-3">
              <Input
                id="wb-code"
                value={code}
                error={error}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="KJRW"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                className="w-32 flex-none text-xl tracking-[0.25em] uppercase"
              />
              <Button type="submit" className="h-15 px-5">
                Join
              </Button>
            </div>
            <InputError id="wb-code" error={error} />
          </form>
          <section className="flex flex-col gap-3 border-3 border-ink bg-paper p-5">
            <h2 className="m-0 text-2xl font-black uppercase">Solo board</h2>
            <p className="m-0 text-sm">Just you. Saved on this device.</p>
            <Link
              to="/whiteboard/solo"
              className="push mt-auto inline-flex h-14 items-center self-start border-3 border-ink bg-paper px-6 font-mono font-bold uppercase no-underline shadow-hard"
            >
              Open
            </Link>
          </section>
        </div>
        <p className="m-0 font-mono text-xs text-mute">
          Shared boards are deleted after 7 days without changes. Anyone with the code can see and
          edit, so don't put private stuff on them.
        </p>
      </main>
    </div>
  );
}

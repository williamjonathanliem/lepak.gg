import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { isValidRoomCode, normalizeRoomCode } from '../../../lib/roomCode';
import { KB } from '../copy';
import { useRoom } from '../net/useRoom';
import { Game } from './Game';
import { LocalBanner } from './Home';
import { Lobby } from './Lobby';
import { NicknameGate } from './NicknameGate';
import { Results } from './Results';
import { useGameSounds } from './useGameSounds';

export function RoomPage() {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) return <Navigate to="/katabomb" replace />;
  if (code !== raw) return <Navigate to={`/katabomb/r/${code}`} replace />;
  return (
    <NicknameGate>{(nickname) => <Room key={code} code={code} nickname={nickname} />}</NicknameGate>
  );
}

function Room({ code, nickname }: { code: string; nickname: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const create = (location.state as { create?: boolean } | null)?.create === true;
  const room = useRoom(code, nickname, create);
  useGameSounds(room);

  const leave = () => {
    room.leave();
    navigate('/katabomb');
  };

  if (room.status === 'connecting' || (room.status === 'ready' && !room.state)) {
    return <Message text={KB.connecting} />;
  }
  if (room.status === 'not-found') return <Message text={KB.notFound} back />;
  if (room.status === 'kicked') return <Message text={KB.kicked} back />;
  if (room.status === 'closed') return <Message text={KB.closed} back />;
  if (room.status === 'error' || !room.state) return <Message text={KB.error} back />;

  const { phase } = room.state;
  return (
    <main className="flex h-full min-h-0 flex-col">
      {room.mode === 'local' && phase !== 'playing' && <LocalBanner />}
      {phase === 'lobby' && <Lobby room={room} code={code} onLeave={leave} />}
      {phase === 'playing' && <Game room={room} />}
      {phase === 'results' && <Results room={room} onLeave={leave} />}
    </main>
  );
}

function Message({ text, back }: { text: string; back?: boolean }) {
  return (
    <main className="flex flex-1 flex-col items-start gap-6 px-gutter py-16">
      <p role="status" className="m-0 font-mono text-lg">
        {text}
      </p>
      {back && (
        <Link to="/katabomb" className="inline-flex min-h-11 items-center font-mono underline">
          {KB.back}
        </Link>
      )}
    </main>
  );
}

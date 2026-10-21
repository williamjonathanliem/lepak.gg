import { Link } from 'react-router';
import { Button } from '../../../components/Button';
import { Confetti } from '../../../components/Confetti';
import { Doodle, HandNote } from '../../../components/Doodle';
import { SectionLabel } from '../../../components/SectionLabel';
import { KB } from '../copy';
import type { Player } from '../logic/types';
import type { Room } from '../net/useRoom';

export function Results({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const state = room.state!;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const ranked = state.placements.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const winner = ranked[0]?.alive ? ranked[0] : null;

  const longest = ranked.reduce<Player | null>(
    (best, p) => (p.longest.length > (best?.longest.length ?? 0) ? p : best),
    null,
  );
  const most = ranked.reduce<Player | null>(
    (best, p) => (p.words > (best?.words ?? 0) ? p : best),
    null,
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-[3px] overflow-y-auto bg-ink">
      {winner && <Confetti />}
      <section className="relative flex flex-col gap-6 bg-ink px-gutter py-12 text-paper on-dark">
        <SectionLabel number="003" title={KB.results} className="text-mute-dark" />
        <p className="m-0 font-mono text-sm uppercase">{winner ? KB.winner : KB.noWinner}</p>
        <h1 className="heading-lg m-0 break-words">{winner?.nickname ?? '...'}</h1>
        {winner && (
          <>
            <Doodle
              name="sparkle"
              filled
              className="absolute top-10 right-10 size-10 animate-wiggle"
            />
            <HandNote rotate={-6}>champion of the lepak</HandNote>
          </>
        )}
        <dl className="m-0 mt-auto grid grid-cols-2 gap-4 font-mono text-sm">
          <div>
            <dt className="text-mute-dark uppercase">{KB.longest}</dt>
            <dd className="m-0 mt-1 text-lg font-bold break-all uppercase">
              {longest?.longest || '-'}
            </dd>
            <dd className="m-0 text-mute-dark">{longest?.nickname}</dd>
          </div>
          <div>
            <dt className="text-mute-dark uppercase">{KB.most}</dt>
            <dd className="m-0 mt-1 text-lg font-bold">{most?.words ?? 0}</dd>
            <dd className="m-0 text-mute-dark">{most?.nickname}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-6 bg-paper px-gutter py-12">
        <ol className="m-0 flex list-none flex-col border-3 border-ink p-0">
          {ranked.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-4 border-ink px-4 py-3 not-last:border-b-3 ${i === 0 && winner ? 'bg-ink text-paper' : ''}`}
            >
              <span className="w-10 font-mono text-2xl font-bold">#{i + 1}</span>
              <span className="flex-1 truncate text-lg font-black uppercase">{p.nickname}</span>
              <span className="font-mono text-sm">{p.words} words</span>
            </li>
          ))}
        </ol>

        <div className="mt-auto flex flex-wrap gap-4">
          {room.isHost ? (
            <>
              <Button onClick={room.start} className="h-14 px-6 text-lg">
                {KB.rematch}
              </Button>
              <button
                type="button"
                onClick={room.toLobby}
                className="min-h-14 cursor-pointer border-3 border-ink bg-paper px-6 font-mono font-bold uppercase"
              >
                {KB.toLobby}
              </button>
            </>
          ) : (
            <p className="m-0 font-mono text-sm">{KB.waitRematch}</p>
          )}
        </div>
        <div className="flex gap-6 font-mono text-sm">
          <button
            type="button"
            onClick={onLeave}
            className="min-h-11 cursor-pointer border-0 bg-transparent p-0 underline"
          >
            {room.isHost ? KB.closeRoom : KB.leave}
          </button>
          <Link to="/hub" className="inline-flex min-h-11 items-center underline">
            {KB.toHub}
          </Link>
        </div>
      </section>
    </div>
  );
}

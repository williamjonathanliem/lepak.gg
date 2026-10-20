import { KB } from '../copy';
import type { Player } from '../logic/types';
import type { Room } from '../net/useRoom';

const TAG = 'border-2 border-current px-1.5 py-0.5 font-mono text-[11px] font-bold';

/** Small status tags next to a name: HOST, YOU, READY, WATCHING, AWAY. */
export function PlayerTags({ room, player }: { room: Room; player: Player }) {
  const state = room.state!;
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
      {state.hostId === player.id && <span className={`${TAG} bg-ink text-paper`}>{KB.host}</span>}
      {room.selfId === player.id && <span className={TAG}>{KB.you}</span>}
      {!player.playing && <span className={TAG}>{KB.watching}</span>}
      {!player.connected && <span className={TAG}>{KB.away}</span>}
      {state.phase === 'lobby' && player.ready && <span className={TAG}>✓ {KB.ready}</span>}
    </span>
  );
}

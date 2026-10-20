import { useEffect, useRef } from 'react';
import type { Room } from '../net/useRoom';
import { sfx } from './sound';

/** Plays a sound for each new game event, plus a ping when the bomb lands on you. */
export function useGameSounds(room: Room) {
  const lastSeq = useRef<number | null>(null);
  const lastHolder = useRef<string | null>(null);
  const state = room.state;

  useEffect(() => {
    if (!state) return;
    const first = lastSeq.current === null;
    if (state.seq === lastSeq.current) return;
    lastSeq.current = state.seq;
    if (first) return; // don't replay whatever happened before we arrived

    const e = state.event;
    if (e) {
      if (e.kind === 'start') sfx.start();
      if (e.kind === 'word') sfx.word();
      if (e.kind === 'boom') {
        sfx.boom();
        // buzz the phone when your own bomb goes off
        if (e.playerId === room.selfId) navigator.vibrate?.(e.out ? [120, 60, 220] : 180);
      }
      if (e.kind === 'win') sfx.win();
      if (e.kind === 'reject' && e.playerId === room.selfId) sfx.reject();
    }
    const holder = state.turn?.playerId ?? null;
    if (holder !== lastHolder.current && holder === room.selfId && e?.kind !== 'start') {
      setTimeout(sfx.yourTurn, 150);
    }
    lastHolder.current = holder;
  }, [state, room.selfId]);
}

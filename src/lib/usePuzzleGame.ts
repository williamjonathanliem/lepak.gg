import { useCallback, useEffect, useRef, useState } from 'react';
import type { PuzzleMode } from '../components/PuzzleShell';
import { readStorage, writeStorage } from './storage';
import {
  EMPTY_PUZZLE_STATS,
  loadJson,
  practiceSeed,
  recordResult,
  saveJson,
  today,
  type PuzzleStats,
} from './puzzle';

// The bookkeeping every daily puzzle game needs: today's puzzle (saved as you play, so a
// refresh keeps your progress), endless practice puzzles, and stats for daily games.
// Game state must be plain JSON (no functions, Sets or Maps).

interface Options<S> {
  /** Short id, used in storage keys: lepak.<id>.day.<n>, lepak.<id>.stats */
  id: string;
  /** A new game for this seed. Same seed, same puzzle. */
  fresh: (seed: string) => S;
  /** null while playing; { won } once finished. */
  outcome: (s: S) => { won: boolean } | null;
}

function loadDay<S>(key: string): S | null {
  try {
    const raw = readStorage(key);
    return raw ? (JSON.parse(raw) as S) : null;
  } catch {
    return null;
  }
}

export function usePuzzleGame<S>({ id, fresh, outcome }: Options<S>) {
  const [day] = useState(today);
  const dayKey = `lepak.${id}.day.${day}`;
  const statsKey = `lepak.${id}.stats`;
  const [mode, setMode] = useState<PuzzleMode>('daily');
  const [daily, setDaily] = useState<S>(() => loadDay<S>(dayKey) ?? fresh(`${id}-${day}`));
  const [practice, setPractice] = useState<S>(() => fresh(practiceSeed()));
  const [stats, setStats] = useState<PuzzleStats>(() => loadJson(statsKey, EMPTY_PUZZLE_STATS));

  const state = mode === 'daily' ? daily : practice;
  // Latest puzzle maker, so "new practice" uses current settings (e.g. a level just picked).
  const freshRef = useRef(fresh);
  useEffect(() => {
    freshRef.current = fresh;
  }, [fresh]);

  /** Change the current game. Saves daily progress and counts a finished daily puzzle. */
  const update = useCallback(
    (next: S | ((s: S) => S)) => {
      if (mode === 'practice') {
        setPractice((s) => (typeof next === 'function' ? (next as (s: S) => S)(s) : next));
        return;
      }
      setDaily((s) => {
        const n = typeof next === 'function' ? (next as (s: S) => S)(s) : next;
        writeStorage(dayKey, JSON.stringify(n));
        const before = outcome(s);
        const after = outcome(n);
        if (!before && after) {
          setStats((st) => {
            const recorded = recordResult(st, day, after.won);
            saveJson(statsKey, recorded);
            return recorded;
          });
        }
        return n;
      });
    },
    [mode, dayKey, statsKey, day, outcome],
  );

  const newPractice = useCallback(() => {
    setPractice(freshRef.current(practiceSeed()));
    setMode('practice');
  }, []);

  return { day, mode, setMode, state, update, newPractice, stats, done: outcome(state) };
}

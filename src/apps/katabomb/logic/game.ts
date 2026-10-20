// KataBomb rules. Pure functions: state in, state out. No React, no network, no timers.
// The host's browser calls these and broadcasts the result.

import { LIMITS, DEFAULT_SETTINGS } from './types';
import type {
  GameEvent,
  GameState,
  Player,
  PromptEntry,
  RejectReason,
  Rng,
  Settings,
} from './types';
import { checkWord, normalizeWord, pickPrompt } from './words';

/** Everything the rules need from outside. Injected so tests control time and luck. */
export interface Env {
  now: number;
  rng: Rng;
  prompts: readonly PromptEntry[];
}

interface NewPerson {
  id: string;
  nickname: string;
}

function emit(state: GameState, event: GameEvent | null): GameState {
  return { ...state, event, seq: state.seq + 1 };
}

function newPlayer({ id, nickname }: NewPerson, playing: boolean): Player {
  return {
    id,
    nickname,
    playing,
    ready: false,
    connected: true,
    lives: 0,
    alive: false,
    words: 0,
    streak: 0,
    longest: '',
    outAt: null,
    color: null,
    emoji: null,
  };
}

function clamp(n: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

// ---------- room ----------

export function createGame(host: NewPerson, settings: Settings = DEFAULT_SETTINGS): GameState {
  return {
    phase: 'lobby',
    hostId: host.id,
    settings,
    players: [newPlayer(host, true)],
    turn: null,
    turnCount: 0,
    matchStartedAt: 0,
    usedWords: [],
    placements: [],
    event: null,
    seq: 0,
  };
}

export type JoinError = 'full';

/**
 * Someone joins or comes back. A returning id keeps their seat (refresh mid-match).
 * New people take a seat in the lobby, or watch if a match is on or seats are full.
 */
export function joinGame(
  state: GameState,
  person: NewPerson,
): { state: GameState; error?: JoinError } {
  const existing = state.players.find((p) => p.id === person.id);
  if (existing) {
    const players = state.players.map((p) =>
      p.id === person.id ? { ...p, nickname: person.nickname, connected: true } : p,
    );
    return { state: emit({ ...state, players }, null) };
  }
  if (state.players.length >= LIMITS.maxPeople) return { state, error: 'full' };
  const seated = state.players.filter((p) => p.playing).length;
  const canPlay = state.phase === 'lobby' && seated < LIMITS.maxPlayers;
  return {
    state: emit({ ...state, players: [...state.players, newPlayer(person, canPlay)] }, null),
  };
}

export function setConnected(state: GameState, id: string, connected: boolean): GameState {
  if (!state.players.some((p) => p.id === id && p.connected !== connected)) return state;
  const players = state.players.map((p) => (p.id === id ? { ...p, connected } : p));
  return emit({ ...state, players }, null);
}

export function setReady(state: GameState, id: string, ready: boolean): GameState {
  if (state.phase !== 'lobby') return state;
  const players = state.players.map((p) => (p.id === id ? { ...p, ready } : p));
  return emit({ ...state, players }, null);
}

export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
  if (state.phase !== 'lobby') return state;
  const merged = { ...state.settings, ...patch };
  const settings: Settings = {
    lives: clamp(merged.lives, LIMITS.lives),
    turnSeconds: clamp(merged.turnSeconds, LIMITS.turnSeconds),
    difficulty: merged.difficulty,
    speedUp: merged.speedUp,
  };
  return emit({ ...state, settings }, null);
}

export const AVATAR_PALETTE_SIZE = 8;
export const AVATAR_EMOJIS = [
  '🐱',
  '🐶',
  '🦊',
  '🐼',
  '🐸',
  '🐵',
  '🦄',
  '🐙',
  '🍜',
  '🍉',
  '🧋',
  '🌶️',
  '🥥',
  '🍌',
  '⚡',
  '🔥',
] as const;

/** A player picks their avatar colour and/or emoji. Unknown values are ignored. */
export function setStyle(
  state: GameState,
  id: string,
  style: { color?: number | null; emoji?: string | null },
): GameState {
  const players = state.players.map((p) => {
    if (p.id !== id) return p;
    const color =
      style.color === undefined
        ? p.color
        : style.color === null ||
            (Number.isInteger(style.color) && style.color >= 0 && style.color < AVATAR_PALETTE_SIZE)
          ? style.color
          : p.color;
    const emoji =
      style.emoji === undefined
        ? p.emoji
        : style.emoji === null || (AVATAR_EMOJIS as readonly string[]).includes(style.emoji)
          ? style.emoji
          : p.emoji;
    return { ...p, color, emoji };
  });
  return emit({ ...state, players }, null);
}

/** Hand the host role to someone else (the old host left or dropped). */
export function setHost(state: GameState, id: string): GameState {
  if (!state.players.some((p) => p.id === id)) return state;
  return emit({ ...state, hostId: id }, null);
}

/** Next host when the current one is gone: first connected person in seat order. */
export function pickNewHost(state: GameState): string | null {
  return state.players.find((p) => p.connected && p.id !== state.hostId)?.id ?? null;
}

// ---------- match ----------

export function seatedPlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.playing);
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.playing && p.alive);
}

export function canStart(state: GameState): boolean {
  return state.phase === 'lobby' && seatedPlayers(state).length >= 2;
}

/** Fuse length for the current turn. With speed-up it drops 0.5s per round, to 40% of the start. */
export function fuseSeconds(state: GameState): number {
  const base = state.settings.turnSeconds;
  if (!state.settings.speedUp) return base;
  const alive = Math.max(1, alivePlayers(state).length);
  const rounds = Math.floor(state.turnCount / alive);
  const floor = Math.max(3, base * 0.4);
  return Math.max(floor, base - rounds * 0.5);
}

function startTurn(state: GameState, playerId: string, env: Env): GameState {
  const prompt = pickPrompt(env.prompts, state.settings.difficulty, env.rng, state.turn?.prompt);
  const solutions = env.prompts.find(([p]) => p === prompt)?.[1] ?? 0;
  const seconds = fuseSeconds(state);
  return {
    ...state,
    turn: { playerId, prompt, solutions, startedAt: env.now, deadline: env.now + seconds * 1000 },
  };
}

/** Next alive player after `fromId` in seat order. */
export function nextAlive(state: GameState, fromId: string): string | null {
  const seats = state.players;
  const start = seats.findIndex((p) => p.id === fromId);
  for (let step = 1; step <= seats.length; step++) {
    const p = seats[(start + step + seats.length) % seats.length]!;
    if (p.playing && p.alive) return p.id;
  }
  return null;
}

export function startGame(state: GameState, env: Env): GameState {
  if (state.phase === 'playing') return state;
  // Anyone watching from the last match gets a seat now, up to the max.
  let seats = 0;
  const players = state.players.map((p) => {
    const playing = seats < LIMITS.maxPlayers;
    if (playing) seats++;
    return {
      ...p,
      playing,
      ready: false,
      lives: playing ? state.settings.lives : 0,
      alive: playing,
      words: 0,
      streak: 0,
      longest: '',
      outAt: null,
    };
  });
  if (players.filter((p) => p.playing).length < 2) return state;

  const fresh: GameState = {
    ...state,
    phase: 'playing',
    players,
    turn: null,
    turnCount: 0,
    matchStartedAt: env.now,
    usedWords: [],
    placements: [],
  };
  const alive = players.filter((p) => p.alive);
  const first = alive[Math.floor(env.rng() * alive.length)]!;
  return emit(startTurn(fresh, first.id, env), { kind: 'start' });
}

function finish(state: GameState): GameState {
  const seated = seatedPlayers(state);
  const winner = seated.find((p) => p.alive) ?? null;
  // Winner first, then whoever lasted longest.
  const out = seated
    .filter((p) => !p.alive)
    .sort((a, b) => (b.outAt ?? 0) - (a.outAt ?? 0))
    .map((p) => p.id);
  return emit(
    {
      ...state,
      phase: 'results',
      turn: null,
      placements: winner ? [winner.id, ...out] : out,
    },
    { kind: 'win', playerId: winner?.id ?? null },
  );
}

/** Pass the bomb on from `fromId`, or end the match if one player is left. */
function passBomb(state: GameState, fromId: string, env: Env, event: GameEvent): GameState {
  const counted = { ...state, turnCount: state.turnCount + 1 };
  if (alivePlayers(counted).length <= 1) return finish(counted);
  const next = nextAlive(counted, fromId);
  if (!next) return finish(counted);
  return emit(startTurn(counted, next, env), event);
}

export type SubmitResult =
  { ok: true; state: GameState } | { ok: false; reason: RejectReason; state: GameState };

export function submitWord(
  state: GameState,
  playerId: string,
  raw: string,
  isWord: (word: string) => boolean,
  env: Env,
): SubmitResult {
  const turn = state.turn;
  if (state.phase !== 'playing' || !turn || turn.playerId !== playerId) {
    return { ok: false, reason: 'not-your-turn', state };
  }
  const reason = checkWord(raw, turn.prompt, state.usedWords, isWord);
  if (reason) return { ok: false, reason, state };

  const word = normalizeWord(raw);
  const players = state.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          words: p.words + 1,
          streak: p.streak + 1,
          longest: word.length > p.longest.length ? word : p.longest,
        }
      : p,
  );
  const next = passBomb(
    { ...state, players, usedWords: [...state.usedWords, word] },
    playerId,
    env,
    { kind: 'word', playerId, word },
  );
  return { ok: true, state: next };
}

/** Tell everyone a word bounced, so the typer gets feedback and others see the miss. */
export function rejectWord(
  state: GameState,
  playerId: string,
  raw: string,
  reason: RejectReason,
): GameState {
  return emit(state, { kind: 'reject', playerId, word: normalizeWord(raw).slice(0, 30), reason });
}

/** Call on every host tick. Blows up the bomb if the fuse ran out. */
export function tick(state: GameState, env: Env): GameState {
  const turn = state.turn;
  if (state.phase !== 'playing' || !turn || env.now < turn.deadline) return state;
  return explode(state, turn.playerId, env);
}

function explode(state: GameState, playerId: string, env: Env): GameState {
  let out = false;
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const lives = Math.max(0, p.lives - 1);
    out = lives === 0;
    return { ...p, lives, streak: 0, alive: !out, outAt: out ? state.turnCount : p.outAt };
  });
  return passBomb({ ...state, players }, playerId, env, { kind: 'boom', playerId, out });
}

/** Someone leaves the room for good. Mid-match they're out; on their turn the bomb moves on. */
export function leaveGame(state: GameState, playerId: string, env: Env): GameState {
  const leaver = state.players.find((p) => p.id === playerId);
  if (!leaver) return state;

  if (state.phase !== 'playing' || !leaver.playing || !leaver.alive) {
    const players = state.players.filter((p) => p.id !== playerId);
    const placements = state.placements.filter((id) => id !== playerId);
    return emit({ ...state, players, placements }, { kind: 'left', playerId });
  }

  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, lives: 0, alive: false, outAt: state.turnCount } : p,
  );
  const marked = { ...state, players };
  if (state.turn?.playerId === playerId) {
    return passBomb(marked, playerId, env, { kind: 'left', playerId });
  }
  if (alivePlayers(marked).length <= 1) return finish(marked);
  return emit(marked, { kind: 'left', playerId });
}

/** Results screen to lobby, same room and people. */
export function backToLobby(state: GameState): GameState {
  const players = state.players.map((p) => ({ ...p, playing: true, ready: false }));
  return emit(
    {
      ...state,
      phase: 'lobby',
      players: players.map((p, i) => ({ ...p, playing: i < LIMITS.maxPlayers })),
      turn: null,
      placements: [],
    },
    null,
  );
}

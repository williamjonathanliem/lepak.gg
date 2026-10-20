export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Settings {
  lives: number; // 1 to 5
  turnSeconds: number; // 5 to 20, the fuse at the start of a match
  difficulty: Difficulty;
  speedUp: boolean; // fuse gets shorter every round
}

export const DEFAULT_SETTINGS: Settings = {
  lives: 3,
  turnSeconds: 10,
  difficulty: 'normal',
  speedUp: true,
};

export const LIMITS = {
  lives: [1, 5],
  turnSeconds: [5, 20],
  maxPlayers: 8,
  maxPeople: 16, // players + people watching
  minWordLength: 3,
  maxWordLength: 30,
} as const;

export interface Player {
  id: string;
  nickname: string;
  /** false = joined mid-match, watching until the next one starts. */
  playing: boolean;
  ready: boolean;
  connected: boolean;
  lives: number;
  alive: boolean;
  words: number;
  /** Good words in a row since their last boom. */
  streak: number;
  longest: string;
  /** Chosen avatar: index into the colour palette, and an optional emoji. null = default. */
  color: number | null;
  emoji: string | null;
  /** turnCount when they ran out of lives, for placements. */
  outAt: number | null;
}

export interface Turn {
  playerId: string;
  prompt: string; // lowercase, e.g. 'tio'
  solutions: number; // how many dictionary words contain it
  startedAt: number; // ms epoch
  deadline: number; // ms epoch
}

export type Phase = 'lobby' | 'playing' | 'results';

export type GameEvent =
  | { kind: 'start' }
  | { kind: 'word'; playerId: string; word: string }
  | { kind: 'boom'; playerId: string; out: boolean }
  | { kind: 'left'; playerId: string }
  | { kind: 'reject'; playerId: string; word: string; reason: RejectReason }
  | { kind: 'win'; playerId: string | null };

export interface GameState {
  phase: Phase;
  hostId: string;
  settings: Settings;
  /** Seat order. Turns go around this list. */
  players: Player[];
  turn: Turn | null;
  turnCount: number;
  /** When the current match started (ms epoch), 0 in the lobby. */
  matchStartedAt: number;
  usedWords: string[];
  /** Results: player ids, winner first. */
  placements: string[];
  /** Latest thing that happened. Clients use it for sounds and shakes. */
  event: GameEvent | null;
  /** Bumps on every change so clients can tell events apart. */
  seq: number;
}

export type RejectReason =
  | 'not-your-turn'
  | 'too-short'
  | 'too-long'
  | 'not-letters'
  | 'missing-prompt'
  | 'already-used'
  | 'not-a-word';

/** [chunk, number of dictionary words containing it] */
export type PromptEntry = readonly [string, number];

/** Random number in [0, 1). Injected so tests are predictable. */
export type Rng = () => number;

import {
  alivePlayers,
  backToLobby,
  canStart,
  createGame,
  fuseSeconds,
  joinGame,
  kickPlayer,
  leaveGame,
  nextAlive,
  pickNewHost,
  setStyle,
  setConnected,
  startGame,
  submitWord,
  tick,
  updateSettings,
  type Env,
} from './game';
import type { GameState, PromptEntry } from './types';

const prompts: PromptEntry[] = [
  ['tio', 600],
  ['ang', 500],
];
const dict = new Set(['nation', 'ratio', 'station', 'motion', 'potion', 'bang', 'angle', 'hang']);
const isWord = (w: string) => dict.has(w);

let clock = 1_000_000;
function env(overrides: Partial<Env> = {}): Env {
  return { now: clock, rng: () => 0, prompts, ...overrides };
}

function lobbyWith(...ids: string[]): GameState {
  let s = createGame({ id: ids[0]!, nickname: ids[0]! });
  for (const id of ids.slice(1)) s = joinGame(s, { id, nickname: id }).state;
  return s;
}

/** Answer correctly for whoever holds the bomb. */
function answer(s: GameState): GameState {
  const prompt = s.turn!.prompt;
  const word = [...dict].find((w) => w.includes(prompt) && !s.usedWords.includes(w))!;
  const r = submitWord(s, s.turn!.playerId, word, isWord, env());
  expect(r.ok).toBe(true);
  return r.state;
}

/** Let the fuse run out for whoever holds the bomb. */
function timeout(s: GameState): GameState {
  return tick(s, env({ now: s.turn!.deadline }));
}

describe('lobby', () => {
  it('needs at least 2 players to start', () => {
    expect(canStart(lobbyWith('a'))).toBe(false);
    expect(canStart(lobbyWith('a', 'b'))).toBe(true);
    expect(startGame(lobbyWith('a'), env()).phase).toBe('lobby');
  });

  it('caps seats at 8; extra people watch', () => {
    const s = lobbyWith('1', '2', '3', '4', '5', '6', '7', '8', '9');
    expect(s.players.filter((p) => p.playing)).toHaveLength(8);
    expect(s.players[8]!.playing).toBe(false);
  });

  it('clamps settings to the allowed ranges', () => {
    const s = updateSettings(lobbyWith('a'), { lives: 9, turnSeconds: 2 });
    expect(s.settings.lives).toBe(5);
    expect(s.settings.turnSeconds).toBe(5);
  });

  it('gives a returning player their seat back', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = setConnected(s, 'b', false);
    const back = joinGame(s, { id: 'b', nickname: 'b2' }).state;
    expect(back.players).toHaveLength(2);
    expect(back.players[1]).toMatchObject({
      id: 'b',
      nickname: 'b2',
      connected: true,
      alive: true,
    });
  });

  it('lets late joiners watch, then play next match', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = joinGame(s, { id: 'late', nickname: 'late' }).state;
    expect(s.players.find((p) => p.id === 'late')).toMatchObject({ playing: false, alive: false });
    s = backToLobby(s);
    s = startGame(s, env());
    expect(s.players.find((p) => p.id === 'late')).toMatchObject({ playing: true, alive: true });
  });
});

describe('turns', () => {
  it('gives everyone full lives and a prompt at the start', () => {
    const s = startGame(lobbyWith('a', 'b', 'c'), env());
    expect(s.phase).toBe('playing');
    expect(s.players.every((p) => p.lives === 3 && p.alive)).toBe(true);
    expect(['tio', 'ang']).toContain(s.turn!.prompt);
    expect(s.turn!.deadline - s.turn!.startedAt).toBe(10_000);
  });

  it('passes the bomb around in seat order on a valid word', () => {
    let s = startGame(lobbyWith('a', 'b', 'c'), env());
    expect(s.turn!.playerId).toBe('a');
    s = answer(s);
    expect(s.turn!.playerId).toBe('b');
    s = answer(s);
    expect(s.turn!.playerId).toBe('c');
    s = answer(s);
    expect(s.turn!.playerId).toBe('a');
  });

  it('rejects a word from someone not holding the bomb', () => {
    const s = startGame(lobbyWith('a', 'b'), env());
    expect(submitWord(s, 'b', 'nation', isWord, env())).toMatchObject({
      ok: false,
      reason: 'not-your-turn',
    });
  });

  it('remembers used words for the whole match', () => {
    let s = startGame(lobbyWith('a', 'b'), env({ rng: () => 0 }));
    const prompt = s.turn!.prompt;
    const word = [...dict].find((w) => w.includes(prompt))!;
    s = submitWord(s, 'a', word, isWord, env()).state;
    // force the same prompt back for b
    s = { ...s, turn: { ...s.turn!, prompt } };
    expect(submitWord(s, 'b', word, isWord, env())).toMatchObject({ reason: 'already-used' });
  });

  it('skips eliminated players', () => {
    let s = startGame(lobbyWith('a', 'b', 'c'), env());
    s = { ...s, players: s.players.map((p) => (p.id === 'b' ? { ...p, alive: false } : p)) };
    expect(nextAlive(s, 'a')).toBe('c');
    expect(nextAlive(s, 'c')).toBe('a');
  });

  it('does nothing before the fuse runs out', () => {
    const s = startGame(lobbyWith('a', 'b'), env());
    expect(tick(s, env({ now: s.turn!.deadline - 1 }))).toBe(s);
  });
});

describe('lives, elimination and winning', () => {
  it('costs a life and passes the bomb when the fuse runs out', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = timeout(s);
    expect(s.players[0]!.lives).toBe(2);
    expect(s.turn!.playerId).toBe('b');
    expect(s.event).toEqual({ kind: 'boom', playerId: 'a', out: false });
  });

  it('knocks a player out at 0 lives and declares the last one standing', () => {
    let s = startGame(updateSettings(lobbyWith('a', 'b', 'c'), { lives: 1 }), env());
    s = timeout(s); // a out
    expect(s.players[0]!.alive).toBe(false);
    expect(s.event).toEqual({ kind: 'boom', playerId: 'a', out: true });
    expect(s.turn!.playerId).toBe('b');
    s = answer(s); // b -> c
    s = timeout(s); // c out
    expect(s.phase).toBe('results');
    expect(s.placements).toEqual(['b', 'c', 'a']);
    expect(s.event).toEqual({ kind: 'win', playerId: 'b' });
  });

  it('ends the match when the second-last player leaves', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = leaveGame(s, 'b', env());
    expect(s.phase).toBe('results');
    expect(s.placements[0]).toBe('a');
  });

  it('moves the bomb on if the holder leaves', () => {
    let s = startGame(lobbyWith('a', 'b', 'c'), env());
    s = leaveGame(s, 'a', env());
    expect(s.turn!.playerId).toBe('b');
    expect(alivePlayers(s).map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('tracks words and the longest word', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = answer(s);
    expect(s.players[0]!.words).toBe(1);
    expect(s.players[0]!.longest.length).toBeGreaterThan(2);
  });
});

describe('fuse speed-up', () => {
  it('gets shorter each round when on', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    expect(fuseSeconds(s)).toBe(10);
    s = answer(answer(s)); // one full round
    expect(fuseSeconds(s)).toBe(9.5);
  });

  it('never drops below 40% of the start', () => {
    const s = startGame(lobbyWith('a', 'b'), env());
    expect(fuseSeconds({ ...s, turnCount: 1000 })).toBe(4);
  });

  it('stays fixed when off', () => {
    const s = startGame(updateSettings(lobbyWith('a', 'b'), { speedUp: false }), env());
    expect(fuseSeconds({ ...s, turnCount: 1000 })).toBe(10);
  });
});

describe('streaks', () => {
  it('counts good words in a row and resets on a boom', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = answer(s); // a
    s = answer(s); // b
    s = answer(s); // a again
    expect(s.players[0]!.streak).toBe(2);
    s = timeout(s); // b booms
    expect(s.players[1]!.streak).toBe(0);
  });
});

describe('avatar style', () => {
  it('accepts a palette colour and a listed emoji', () => {
    const s = setStyle(lobbyWith('a'), 'a', { color: 3, emoji: '🐸' });
    expect(s.players[0]).toMatchObject({ color: 3, emoji: '🐸' });
  });

  it('ignores colours and emoji that are not on the list', () => {
    const s = setStyle(lobbyWith('a'), 'a', { color: 99, emoji: '<script>' });
    expect(s.players[0]).toMatchObject({ color: null, emoji: null });
  });

  it('only changes the sender', () => {
    const s = setStyle(lobbyWith('a', 'b'), 'b', { color: 1 });
    expect(s.players[0]!.color).toBeNull();
    expect(s.players[1]!.color).toBe(1);
  });
});

describe('host', () => {
  it('picks the next connected person as host', () => {
    let s = lobbyWith('a', 'b', 'c');
    s = setConnected(s, 'b', false);
    expect(pickNewHost(s)).toBe('c');
  });
});

afterEach(() => {
  clock += 1;
});

describe('kicking', () => {
  it('removes the player and stops them joining again', () => {
    let s = kickPlayer(lobbyWith('a', 'b', 'c'), 'b', env());
    expect(s.players.map((p) => p.id)).toEqual(['a', 'c']);
    const again = joinGame(s, { id: 'b', nickname: 'b' });
    expect(again.error).toBe('kicked');
    expect(again.state.players).toHaveLength(2);
    s = kickPlayer(s, 'a', env());
    expect(s.players.map((p) => p.id)).toEqual(['a', 'c']); // host can't kick themself
  });

  it('mid-match, kicking the last opponent ends the match', () => {
    let s = startGame(lobbyWith('a', 'b'), env());
    s = kickPlayer(s, 'b', env());
    expect(s.phase).toBe('results');
  });
});

import {
  COUNTDOWN_MS,
  isOver,
  newMeta,
  rematch,
  setMode,
  standings,
  startRace,
  type Racer,
} from './race';
import { CUSTOM_MAX, SENTENCES, WORDS, cleanCustom, raceText } from './text';
import { accuracy, backspace, newTyping, typeChar, wpm } from './typing';
import {
  LIVES,
  difficulty,
  fallMsAt,
  lengthsAt,
  newWaveState,
  onScreen,
  pointsFor,
  press,
  release,
  tick,
  type Rules,
  type WaveState,
} from './waves';

const typeAll = (text: string, s = newTyping(text)) =>
  [...text].reduce((st, ch, i) => typeChar(st, ch, i + 1), s);

describe('ketik race texts', () => {
  it('gives everyone the same text for a seed, and a different one for the next round', () => {
    expect(raceText('A', 'sentences', 'short')).toBe(raceText('A', 'sentences', 'short'));
    expect(raceText('A', 'words', 'medium')).not.toBe(raceText('B', 'words', 'medium'));
  });

  it('makes longer texts for longer races', () => {
    const short = raceText('s', 'words', 'short').length;
    const long = raceText('s', 'words', 'long').length;
    expect(long).toBeGreaterThan(short * 2);
  });

  it('has clean typing text: plain characters, no em dashes', () => {
    for (const s of SENTENCES) expect(s).toMatch(/^[\x20-\x7e]+$/);
    for (const [len, words] of Object.entries(WORDS)) {
      for (const w of words) expect(w).toHaveLength(Number(len));
    }
  });

  it('cleans pasted text and refuses junk', () => {
    expect(cleanCustom('  Photosynthesis \n makes   “glucose” — fast…  ')).toBe(
      'Photosynthesis makes "glucose" - fast...',
    );
    expect(cleanCustom('hi')).toBeNull();
    expect(cleanCustom('word '.repeat(200))!.length).toBeLessThanOrEqual(CUSTOM_MAX);
  });
});

describe('sentence typing', () => {
  it('finishes when every character is typed right', () => {
    const done = typeAll('hello there');
    expect(done.pos).toBe(11);
    expect(done.finishedAt).toBe(11);
    expect(done.errors).toBe(0);
  });

  it('stops at a wrong letter until backspace', () => {
    let s = typeChar(newTyping('cat'), 'c', 1);
    s = typeChar(s, 'x', 2);
    expect(s).toMatchObject({ pos: 1, wrong: true, errors: 1 });
    s = typeChar(s, 'a', 3); // still stuck
    expect(s).toMatchObject({ pos: 1, errors: 2 });
    s = typeChar(backspace(s), 'a', 4);
    expect(s).toMatchObject({ pos: 2, wrong: false });
  });

  it('works out WPM and accuracy', () => {
    expect(wpm(250, 60_000)).toBe(50);
    expect(wpm(10, 0)).toBe(0);
    expect(accuracy(90, 10)).toBe(90);
    expect(accuracy(0, 0)).toBe(100);
  });
});

describe('word mode', () => {
  const timeRules: Rules = { seed: 'room', goal: 'time', limitMs: 180_000, targetScore: 1000 };
  const pointRules: Rules = { ...timeRules, goal: 'points' };
  /** Plays to time t with nobody typing. */
  const idle = (rules: Rules, t: number, s: WaveState = newWaveState()) => tick(rules, s, t);
  const zapFirst = (rules: Rules, s: WaveState, t: number) => {
    const w = onScreen(s, t)[0]!;
    return [...w.word].reduce((st, ch) => press(rules, st, t, ch), s);
  };

  it('gives everyone in a time game the same words at the same moments', () => {
    const a = idle(timeRules, 20_000, { ...newWaveState(), lives: 99 });
    const b = idle(timeRules, 20_000, { ...newWaveState(), lives: 99 });
    expect(a.words).toEqual(b.words);
    expect(idle({ ...timeRules, seed: 'other' }, 20_000).words[0]).not.toEqual(a.words[0]);
  });

  it('gets faster, with longer words, the closer you are to the target', () => {
    expect(fallMsAt(1)).toBeLessThan(fallMsAt(0) / 3);
    expect(lengthsAt(0)).toEqual([3, 4]);
    expect(lengthsAt(1)[1]).toBe(9);
    const s = { ...newWaveState(), lives: 999 };
    const late = idle(timeRules, 175_000, s);
    const early = late.words.filter((w) => w.spawnAt < 20_000);
    const end = late.words.filter((w) => w.spawnAt > 150_000);
    const avg = (ws: typeof early, f: (w: (typeof early)[0]) => number) =>
      ws.reduce((n, w) => n + f(w), 0) / ws.length;
    expect(avg(end, (w) => w.fallMs)).toBeLessThan(avg(early, (w) => w.fallMs));
    expect(avg(end, (w) => w.word.length)).toBeGreaterThan(avg(early, (w) => w.word.length));
    // and they come more often
    expect(end.length / 25).toBeGreaterThan(early.length / 20);
  });

  it('measures difficulty by the clock, or by your score in a points game', () => {
    const s = { ...newWaveState(), score: 500 };
    expect(difficulty(timeRules, s, 90_000)).toBe(0.5);
    expect(difficulty(pointRules, s, 1000)).toBe(0.5);
  });

  it('keeps first letters on screen different where it can', () => {
    let s: WaveState = { ...newWaveState(), lives: 999 };
    for (let t = 0; t < 60_000; t += 500) {
      s = tick(timeRules, s, t);
      const firsts = onScreen(s, t).map((w) => w.word[0]);
      expect(new Set(firsts).size).toBeGreaterThanOrEqual(firsts.length - 1);
    }
  });

  it('zaps a word typed in full, locking on with the first letter', () => {
    const t = 2000;
    const s = idle(timeRules, t);
    const first = onScreen(s, t)[0]!;
    const after = zapFirst(timeRules, s, t);
    expect(after.zapped).toEqual([first.id]);
    expect(after.score).toBe(pointsFor(first.word, 0));
    expect(onScreen(after, t).some((w) => w.id === first.id)).toBe(false);
  });

  it('counts a wrong key as a mistake and breaks the combo', () => {
    const t = 2000;
    let s = { ...idle(timeRules, t), combo: 4 };
    const first = onScreen(s, t)[0]!;
    s = press(timeRules, s, t, first.word[0]!);
    s = press(timeRules, s, t, first.word[1] === 'q' ? 'z' : 'q');
    expect(s).toMatchObject({ errors: 1, combo: 0, target: first.id, typed: 1 });
    expect(release(s)).toMatchObject({ target: null, typed: 0 });
  });

  it('takes lives as words get through, and ends at zero', () => {
    const s = idle(timeRules, 60_000);
    expect(s.lives).toBe(0);
    expect(s.missed.length).toBeGreaterThanOrEqual(LIVES);
    expect(s.outAt).not.toBeNull();
    expect(press(timeRules, s, 60_001, 'a')).toBe(s);
  });

  it('wins a points game on reaching the target', () => {
    const t = 2000;
    const s = { ...idle(pointRules, t), score: pointRules.targetScore - 10 };
    const after = zapFirst(pointRules, s, t);
    expect(after.wonAt).toBe(t);
    expect(tick(pointRules, after, t + 99_999)).toBe(after);
  });
});

describe('ketik race rooms', () => {
  const racer = (over: Partial<Racer>): Racer => ({
    uid: 'u',
    nick: 'a',
    av: 0,
    round: 1,
    pos: 0,
    total: 100,
    correct: 0,
    errors: 0,
    finishedAt: 0,
    score: 0,
    lives: LIVES,
    outAt: 0,
    ...over,
  });

  it('starts after a countdown, and a rematch is a fresh round', () => {
    const m = startRace(newMeta('h', 'sentence'), 1000);
    expect(m.startAt).toBe(1000 + COUNTDOWN_MS);
    expect(rematch(m)).toMatchObject({ phase: 'lobby', round: 2, startAt: 0 });
    expect(setMode(m, 'words').limitSec).toBe(180);
  });

  it('ranks sentence racers by finish time, then progress', () => {
    const m = startRace(newMeta('h', 'sentence'), 0);
    const rows = standings(
      m,
      [
        racer({ uid: 'slow', finishedAt: m.startAt + 50_000, pos: 100 }),
        racer({ uid: 'mid', pos: 80 }),
        racer({ uid: 'fast', finishedAt: m.startAt + 30_000, pos: 100 }),
        racer({ uid: 'behind', pos: 20 }),
      ],
      m.startAt + 60_000,
    );
    expect(rows.map((r) => r.uid)).toEqual(['fast', 'slow', 'mid', 'behind']);
    expect(rows[0]!.timeMs).toBe(30_000);
  });

  it('ranks word mode by score, then by who survived longer', () => {
    const m = startRace(newMeta('h', 'words'), 0);
    const rows = standings(
      m,
      [
        racer({ uid: 'low', score: 100 }),
        racer({ uid: 'outEarly', score: 300, lives: 0, outAt: 20_000 }),
        racer({ uid: 'outLate', score: 300, lives: 0, outAt: 50_000 }),
      ],
      m.startAt + 60_000,
    );
    expect(rows.map((r) => r.uid)).toEqual(['outLate', 'outEarly', 'low']);
  });

  it('in a points game, whoever reaches the target first wins and the game ends', () => {
    const m = { ...startRace(newMeta('h', 'words'), 0), goal: 'points' as const };
    const racers = [
      racer({ uid: 'high', score: 900 }),
      racer({ uid: 'second', score: 1000, finishedAt: m.startAt + 70_000 }),
      racer({ uid: 'first', score: 1010, finishedAt: m.startAt + 60_000 }),
    ];
    expect(standings(m, racers, m.startAt + 80_000).map((r) => r.uid)).toEqual([
      'first',
      'second',
      'high',
    ]);
    expect(isOver(m, racers, m.startAt + 80_000)).toBe(true);
  });

  it('ends when everyone is done, or at the time limit', () => {
    const m = startRace(newMeta('h', 'words'), 0);
    const going = [racer({ uid: 'a' }), racer({ uid: 'b', lives: 0, outAt: 5000 })];
    expect(isOver(m, going, m.startAt + 1000)).toBe(false);
    expect(isOver(m, going, m.startAt + m.limitSec * 1000)).toBe(true);
    expect(
      isOver(
        m,
        going.map((r) => ({ ...r, lives: 0, outAt: 1 })),
        m.startAt + 10,
      ),
    ).toBe(true);
  });
});

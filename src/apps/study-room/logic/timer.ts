// Study Room's shared focus timer (Pomodoro style). Pure: the room stores one timer, and
// every screen works out the time left from it, so everyone sees the same countdown.
//
// While running, the timer stores when the phase ends (`endsAt`, server time). While
// paused, it stores how much was left (`leftMs`). Anyone in the room can start, pause or
// skip; when a phase runs out, the next one starts by itself.

export type Phase = 'focus' | 'break';

export interface Timer {
  phase: Phase;
  running: boolean;
  /** When the phase ends (ms, server time). Only meaningful while running. */
  endsAt: number;
  /** Time left while paused (ms). */
  leftMs: number;
  focusMin: number;
  breakMin: number;
  /** Focus rounds finished so far. */
  rounds: number;
}

export const FOCUS_CHOICES = [25, 45, 50, 90] as const;
export const BREAK_CHOICES = [5, 10, 15] as const;
/** Every fourth break is a long one. */
export const LONG_BREAK_EVERY = 4;

const MIN = 60_000;

export const phaseLength = (t: Pick<Timer, 'focusMin' | 'breakMin' | 'rounds'>, phase: Phase) =>
  phase === 'focus'
    ? t.focusMin * MIN
    : (t.rounds > 0 && t.rounds % LONG_BREAK_EVERY === 0 ? t.breakMin * 3 : t.breakMin) * MIN;

export function newTimer(focusMin = 25, breakMin = 5): Timer {
  return {
    phase: 'focus',
    running: false,
    endsAt: 0,
    leftMs: focusMin * MIN,
    focusMin,
    breakMin,
    rounds: 0,
  };
}

export function remaining(t: Timer, now: number): number {
  return t.running ? Math.max(0, t.endsAt - now) : t.leftMs;
}

export function start(t: Timer, now: number): Timer {
  if (t.running) return t;
  return { ...t, running: true, endsAt: now + t.leftMs };
}

export function pause(t: Timer, now: number): Timer {
  if (!t.running) return t;
  return { ...t, running: false, leftMs: remaining(t, now) };
}

/** On to the next phase (focus → break → focus...). Finishing a focus counts a round. */
export function next(t: Timer, now: number, keepRunning = t.running): Timer {
  const finishedFocus = t.phase === 'focus';
  const rounds = finishedFocus ? t.rounds + 1 : t.rounds;
  const phase: Phase = finishedFocus ? 'break' : 'focus';
  const len = phaseLength({ ...t, rounds }, phase);
  return {
    ...t,
    phase,
    rounds,
    running: keepRunning,
    endsAt: keepRunning ? now + len : 0,
    leftMs: len,
  };
}

/** If a running phase has run out, the timer it should be now (else the same timer). */
export function catchUp(t: Timer, now: number): Timer {
  if (!t.running || now < t.endsAt) return t;
  // Move on from the moment it actually ended, so screens that were asleep agree.
  return next(t, t.endsAt);
}

/** Change the lengths. Resets the current phase to the new length (paused). */
export function setLengths(t: Timer, focusMin: number, breakMin: number): Timer {
  const n = { ...t, focusMin, breakMin, running: false };
  return { ...n, leftMs: phaseLength(n, n.phase) };
}

/** "24:59", or "1:29:59" for long ones. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

// Sentence mode: type the text exactly. A wrong letter stops you until you backspace it,
// so speed comes from accuracy. Pure: state in, state out.

export interface TypingState {
  text: string;
  /** Characters typed correctly so far. */
  pos: number;
  /** Set while a wrong letter is waiting to be backspaced. */
  wrong: boolean;
  /** Every key that matched. */
  correct: number;
  /** Every key that didn't. */
  errors: number;
  finishedAt: number | null;
}

export const newTyping = (text: string): TypingState => ({
  text,
  pos: 0,
  wrong: false,
  correct: 0,
  errors: 0,
  finishedAt: null,
});

/** One typed character. */
export function typeChar(s: TypingState, ch: string, now: number): TypingState {
  if (s.finishedAt !== null || s.wrong) {
    // Stuck on a wrong letter: further typing counts as more mistakes, not progress.
    return s.finishedAt !== null ? s : { ...s, errors: s.errors + 1 };
  }
  if (ch !== s.text[s.pos]) return { ...s, wrong: true, errors: s.errors + 1 };
  const pos = s.pos + 1;
  return {
    ...s,
    pos,
    correct: s.correct + 1,
    finishedAt: pos >= s.text.length ? now : null,
  };
}

/** Backspace clears a wrong letter (correct letters stay typed). */
export const backspace = (s: TypingState): TypingState => (s.wrong ? { ...s, wrong: false } : s);

/** Words per minute, using the usual 5 characters = 1 word. */
export function wpm(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(chars / 5 / (ms / 60_000));
}

/** Share of keys that were right, 0..100. */
export function accuracy(correct: number, errors: number): number {
  const total = correct + errors;
  return total ? Math.round((correct / total) * 100) : 100;
}

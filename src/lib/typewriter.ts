// Pure typewriter state machine. The Typewriter component drives it with a timer.

export interface TypewriterState {
  wordIndex: number;
  length: number; // characters currently shown
  deleting: boolean;
  pauseTicks: number; // ticks to wait before the next change
}

export interface TypewriterTiming {
  holdTicks: number; // pause on a full word
  gapTicks: number; // pause on an empty block before the next word
}

/** Start with the first word fully shown, holding before it deletes. */
export function initialTypewriter(
  words: readonly string[],
  timing: TypewriterTiming,
): TypewriterState {
  return {
    wordIndex: 0,
    length: words[0]?.length ?? 0,
    deleting: true,
    pauseTicks: timing.holdTicks,
  };
}

export function stepTypewriter(
  state: TypewriterState,
  words: readonly string[],
  timing: TypewriterTiming,
): TypewriterState {
  if (words.length === 0) return state;
  if (state.pauseTicks > 0) return { ...state, pauseTicks: state.pauseTicks - 1 };

  const word = words[state.wordIndex % words.length] ?? '';
  if (!state.deleting) {
    const length = state.length + 1;
    return length >= word.length
      ? { ...state, length: word.length, deleting: true, pauseTicks: timing.holdTicks }
      : { ...state, length };
  }
  const length = state.length - 1;
  return length <= 0
    ? {
        wordIndex: (state.wordIndex + 1) % words.length,
        length: 0,
        deleting: false,
        pauseTicks: timing.gapTicks,
      }
    : { ...state, length };
}

export function visibleText(state: TypewriterState, words: readonly string[]): string {
  return (words[state.wordIndex % words.length] ?? '').slice(0, state.length);
}

import { useEffect, useState } from 'react';
import { initialTypewriter, stepTypewriter, visibleText } from '../lib/typewriter';
import { useReducedMotion } from '../lib/useReducedMotion';

interface TypewriterProps {
  words: readonly string[];
  /** Milliseconds per character. */
  speed?: number;
  /** Milliseconds to hold a full word before deleting. */
  holdMs?: number;
  /** Milliseconds on the empty block before typing the next word. */
  gapMs?: number;
}

/**
 * Black block that types and deletes words in a loop, with a blinking cursor.
 * Visual only (aria-hidden): give the parent heading an aria-label with the full sentence.
 * With reduced motion it shows the first word and stays still.
 */
export function Typewriter({ words, speed = 85, holdMs = 1700, gapMs = 340 }: TypewriterProps) {
  const reducedMotion = useReducedMotion();
  const timing = { holdTicks: Math.round(holdMs / speed), gapTicks: Math.round(gapMs / speed) };
  const [state, setState] = useState(() => initialTypewriter(words, timing));

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setState((s) => stepTypewriter(s, words, timing)), speed);
    return () => clearInterval(id);
    // timing is derived from these props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, words, speed, holdMs, gapMs]);

  const text = reducedMotion ? (words[0] ?? '') : visibleText(state, words);

  return (
    <span
      aria-hidden="true"
      className="inline-flex max-w-full items-baseline bg-ink px-[0.12em] text-paper [overflow-wrap:anywhere]"
    >
      {/* zero-width space keeps the block height when the word is empty */}
      {text || '​'}
      <span className="ml-[0.06em] inline-block h-[0.82em] w-[0.5em] animate-blink self-center bg-paper" />
    </span>
  );
}

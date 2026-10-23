import { useEffect, useRef } from 'react';
import { accuracy, wpm, type TypingState } from '../logic/typing';

// Sentence mode: the text to type (done / wrong / next letter), and the box you type in.
// A real <input> so phone keyboards work; each keystroke is read and the box is cleared.

export function SentencePlay({
  state: s,
  onChar,
  onBackspace,
  locked,
  elapsedMs,
}: {
  state: TypingState;
  onChar: (ch: string) => void;
  onBackspace: () => void;
  locked: boolean;
  elapsedMs: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [locked]);

  // Show a window of the text around where you are, so long texts don't push the page.
  const from = Math.max(0, s.text.lastIndexOf(' ', Math.max(0, s.pos - 60)) + 1);
  const to = Math.min(s.text.length, from + 220);

  return (
    <section aria-label="Your text" className="flex flex-col gap-3">
      <p
        className="m-0 border-3 border-ink bg-paper p-4 font-mono text-[clamp(16px,2.4vw,21px)] leading-relaxed break-words"
        onClick={() => input.current?.focus()}
        aria-hidden="true"
      >
        {from > 0 && <span className="text-mute">… </span>}
        <span className="text-[#1f8a4c]">{s.text.slice(from, s.pos)}</span>
        {s.pos < s.text.length && (
          <span
            className={`${s.wrong ? 'bg-hot text-ink' : 'bg-ink text-paper'} rounded-[2px] px-[1px]`}
          >
            {s.text[s.pos] === ' ' ? ' ' : s.text[s.pos]}
          </span>
        )}
        <span>{s.text.slice(s.pos + 1, to)}</span>
        {to < s.text.length && <span className="text-mute"> …</span>}
      </p>
      <label className="sr-only" htmlFor="ketik-input">
        Type the text. A wrong letter turns red: press backspace to fix it.
      </label>
      <input
        id="ketik-input"
        ref={input}
        disabled={locked}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="next"
        value=""
        placeholder={locked ? '' : s.wrong ? 'Oops: backspace to fix it' : 'Type here'}
        onChange={(e) => {
          for (const ch of e.target.value) onChar(ch);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') {
            e.preventDefault();
            onBackspace();
          }
        }}
        className={`h-14 w-full border-3 bg-paper px-4 font-mono text-xl ${s.wrong ? 'border-hot' : 'border-ink'}`}
      />
      <div className="flex flex-wrap gap-2 font-mono text-sm">
        <span className="border-2 border-ink px-2 py-1">
          <b>{wpm(s.pos, elapsedMs)}</b> wpm
        </span>
        <span className="border-2 border-ink px-2 py-1">
          <b>{accuracy(s.correct, s.errors)}%</b> accuracy
        </span>
        <span className="border-2 border-ink px-2 py-1">
          <b>{Math.round((s.pos / Math.max(1, s.text.length)) * 100)}%</b> done
        </span>
      </div>
    </section>
  );
}

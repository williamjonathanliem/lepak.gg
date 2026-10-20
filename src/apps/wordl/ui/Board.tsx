import { MAX_GUESSES, WORD_LENGTH, scoreGuess, type Mark, type WordlState } from '../logic/wordl';
import { MARK_STYLE } from './marks';

const MARK_LABEL: Record<Mark, string> = {
  correct: 'right spot',
  present: 'in the word',
  absent: 'not in the word',
};

interface BoardProps {
  state: WordlState;
  typed: string;
  /** Changes when a guess is rejected, to shake the current row. */
  shakeId: number;
}

/** The 6 by 5 grid. Sized to the space left, so the page never scrolls. */
export function Board({ state, typed, shakeId }: BoardProps) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    const guess = state.guesses[r];
    if (guess) return { letters: guess, marks: scoreGuess(guess, state.answer), current: false };
    const current = r === state.guesses.length && state.status === 'playing';
    return { letters: current ? typed : '', marks: null, current };
  });

  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
      <div
        role="grid"
        aria-label="Guesses"
        className="grid aspect-[5/6] h-[min(100cqh,calc(100cqw*6/5),440px)] grid-rows-6 gap-1.5"
      >
        {rows.map((row, r) => (
          <div
            key={row.current ? `cur-${shakeId}` : r}
            role="row"
            className={`grid grid-cols-5 gap-1.5 ${row.current && shakeId ? 'animate-shake' : ''}`}
          >
            {Array.from({ length: WORD_LENGTH }, (_, c) => {
              const ch = row.letters[c] ?? '';
              const mark = row.marks?.[c];
              return (
                <div
                  key={c}
                  role="gridcell"
                  aria-label={
                    ch ? `${ch.toUpperCase()}${mark ? `, ${MARK_LABEL[mark]}` : ''}` : 'empty'
                  }
                  className={`flex items-center justify-center border-3 font-sans text-[clamp(22px,7cqh,40px)] leading-none font-black uppercase ${
                    mark
                      ? `${MARK_STYLE[mark]} animate-flip`
                      : ch
                        ? 'animate-pop border-ink bg-paper'
                        : 'border-[#d4d4d4] bg-paper'
                  }`}
                  style={mark ? { animationDelay: `${c * 0.12}s` } : undefined}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../../lib/useReducedMotion';

// A fake AI Notes practice session that loops: a card flips, someone taps "got it", the
// progress bar fills. Shows the study side in a few seconds. Nothing talks to the network.

const CARDS = [
  { front: 'What does the Calvin cycle make?', back: 'Glucose, from CO₂' },
  { front: 'Where do light reactions happen?', back: 'Thylakoid membranes' },
  { front: 'What does RuBisCO do?', back: 'Fixes carbon dioxide' },
  { front: 'What limits photosynthesis?', back: 'Light, CO₂, temperature' },
];

/** Beats per card: show the question, flip, press "got it". */
const BEAT_MS = [1400, 1500, 700];

export function StudyDemo() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setTick((n) => n + 1), BEAT_MS[tick % 3]);
    return () => clearTimeout(t);
  }, [reduced, tick]);

  const card = Math.floor(tick / 3) % CARDS.length;
  const beat = reduced ? 1 : tick % 3;
  const c = CARDS[card]!;
  const flipped = beat >= 1;
  const learnt = (reduced ? 2 : card + (beat === 2 ? 1 : 0)) % (CARDS.length + 1);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[5cqmin] overflow-hidden bg-[#fff4c2] p-[6cqmin] [container-type:size]">
      <div className="flex w-[80%] items-center justify-between font-mono text-[3.2cqmin] font-bold uppercase">
        <span>AI Notes · Flashcards</span>
        <span>{learnt} / 12 learnt</span>
      </div>
      <div className="h-[3cqmin] w-[80%] border-3 border-ink bg-paper">
        <div
          className="h-full bg-[#7ee081] transition-[width] duration-500"
          style={{ width: `${(learnt / 12) * 100}%` }}
        />
      </div>
      <div className="w-[80%] [perspective:1000px]">
        <div
          className="relative h-[38cqmin] [transform-style:preserve-3d] transition-transform duration-500"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqmin] border-3 border-ink bg-[#ffd23f] p-[4cqmin] text-center shadow-hard [backface-visibility:hidden]">
            <span className="font-mono text-[3cqmin] uppercase">Question</span>
            <span className="text-[5.4cqmin] leading-tight font-black">{c.front}</span>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2cqmin] border-3 border-ink bg-paper p-[4cqmin] text-center shadow-hard [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="font-mono text-[3cqmin] uppercase">Answer</span>
            <span className="text-[6cqmin] leading-tight font-black">{c.back}</span>
          </div>
        </div>
      </div>
      <div className="grid w-[80%] grid-cols-2 gap-[3cqmin] font-mono text-[3.4cqmin] font-bold uppercase">
        <span className="border-3 border-ink bg-paper py-[2cqmin] text-center">Again</span>
        <span
          className={`border-3 border-ink py-[2cqmin] text-center transition-transform ${beat === 2 ? 'translate-x-1 translate-y-1 bg-ink text-paper' : 'bg-[#7ee081] shadow-hard-sm'}`}
        >
          Got it ✓
        </span>
      </div>
    </div>
  );
}

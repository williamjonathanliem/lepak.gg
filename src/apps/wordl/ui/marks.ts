import type { Mark } from '../logic/wordl';

/** Tile and key colours for each result. Green and yellow keep black text readable. */
export const MARK_STYLE: Record<Mark, string> = {
  correct: 'bg-[#7ee081] border-ink text-ink',
  present: 'bg-[#ffd23f] border-ink text-ink',
  absent: 'bg-[#3a3a3a] border-[#3a3a3a] text-paper',
};

// Helpers for live co-editing a plain textarea. Pure, so they're easy to test.

export interface TextChange {
  /** Where the change starts. */
  index: number;
  /** How many characters were removed there. */
  remove: number;
  /** What was typed in their place. */
  insert: string;
}

/**
 * The single edit that turns `before` into `after` (what a keystroke, paste or cut does),
 * found by trimming the common start and end. Null when nothing changed.
 */
export function textDiff(before: string, after: string): TextChange | null {
  if (before === after) return null;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  return { index: start, remove: endB - start, insert: after.slice(start, endA) };
}

/** A Yjs text delta: keep n characters, delete n characters, or insert some text. */
export type DeltaOp = { retain?: number; delete?: number; insert?: unknown };

/**
 * Where a cursor at `pos` ends up after someone else's edit, so your cursor doesn't jump
 * when a friend types above it.
 */
export function shiftPosition(pos: number, delta: readonly DeltaOp[]): number {
  let at = 0; // position in the old text
  let shift = 0;
  for (const op of delta) {
    if (at > pos) break;
    if (op.retain) at += op.retain;
    else if (op.delete) {
      const gone = Math.min(op.delete, Math.max(0, pos - at));
      shift -= gone;
      at += op.delete;
    } else if (typeof op.insert === 'string') {
      if (at <= pos) shift += op.insert.length;
    }
  }
  return Math.max(0, pos + shift);
}

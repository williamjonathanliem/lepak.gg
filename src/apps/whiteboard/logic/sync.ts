// Whiteboard sync rules. Pure functions, no React, no network.
//
// Every shape on the board carries a version number that goes up each time it's edited.
// When two people's copies disagree, the higher version wins. If both edited at the same
// moment (same version), the smaller versionNonce wins, so every device picks the same one.

export interface Versioned {
  id: string;
  version: number;
  versionNonce: number;
}

/** True if `a` should replace `b`. */
export function isNewer(a: Versioned, b: Versioned | undefined): boolean {
  if (!b) return true;
  if (a.version !== b.version) return a.version > b.version;
  return a.versionNonce < b.versionNonce;
}

/** Merges remote shapes into local ones. Keeps local order, adds new shapes at the end. */
export function mergeElements<T extends Versioned>(local: readonly T[], remote: readonly T[]): T[] {
  const byId = new Map(local.map((e) => [e.id, e]));
  const added: T[] = [];
  for (const r of remote) {
    const cur = byId.get(r.id);
    if (!cur) {
      added.push(r);
      byId.set(r.id, r);
    } else if (isNewer(r, cur)) {
      byId.set(r.id, r);
    }
  }
  return [...local.map((e) => byId.get(e.id)!), ...added];
}

/** Shapes whose version is newer than what we last sent or received for them. */
export function changedSince<T extends Versioned>(
  elements: readonly T[],
  known: ReadonlyMap<string, number>,
): T[] {
  return elements.filter((e) => e.version > (known.get(e.id) ?? -1));
}

/** Largest single shape we sync (characters of JSON). Must match database.rules.json. */
export const MAX_ELEMENT_CHARS = 30000;

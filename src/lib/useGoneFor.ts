import { useEffect, useState } from 'react';

/** How long a host can drop off (a refresh, a wobbly connection) before their room closes. */
export const HOST_GRACE_MS = 10_000;

/**
 * True once `present` has stayed false for `ms`. It stays true after that: a closed room
 * doesn't reopen.
 */
export function useGoneFor(present: boolean, ms = HOST_GRACE_MS): boolean {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (present || gone) return;
    const t = setTimeout(() => setGone(true), ms);
    return () => clearTimeout(t);
  }, [present, gone, ms]);
  return gone;
}

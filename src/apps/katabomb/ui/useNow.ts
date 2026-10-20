import { useEffect, useState } from 'react';

/** Re-renders every `ms` with the current time from `clock`. */
export function useNow(clock: () => number, active: boolean, ms = 100): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(clock()), ms);
    return () => clearInterval(id);
  }, [clock, active, ms]);
  return now;
}

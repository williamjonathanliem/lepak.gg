import { useEffect, useState } from 'react';

// Loads a puzzle file from public/games once per page visit (cached), for the word games.

const cache = new Map<string, Promise<unknown>>();

function load(url: string): Promise<unknown> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json() as Promise<unknown>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** The parsed file, null while loading, or 'error'. Pass null to load nothing yet. */
export function usePuzzleData<T>(url: string | null): T | null | 'error' {
  const [data, setData] = useState<{ url: string; value: T | 'error' } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    load(url)
      .then((v) => alive && setData({ url, value: v as T }))
      .catch(() => alive && setData({ url, value: 'error' }));
    return () => {
      alive = false;
    };
  }, [url]);
  return data && data.url === url ? data.value : null;
}

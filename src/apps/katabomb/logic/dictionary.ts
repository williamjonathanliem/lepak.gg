import type { PromptEntry } from './types';
import { parseDictionary } from './words';

export interface Dictionary {
  words: Set<string>;
  prompts: PromptEntry[];
}

// Loaded once per language, only when a match is about to start (about 1.7 MB of text).
const cache = new Map<string, Promise<Dictionary>>();

export function loadDictionary(lang = 'en'): Promise<Dictionary> {
  let pending = cache.get(lang);
  if (!pending) {
    pending = Promise.all([
      fetch(`/words/${lang}.txt`).then((r) => {
        if (!r.ok) throw new Error(`word list ${r.status}`);
        return r.text();
      }),
      fetch(`/words/${lang}-prompts.json`).then((r) => {
        if (!r.ok) throw new Error(`prompts ${r.status}`);
        return r.json() as Promise<PromptEntry[]>;
      }),
    ]).then(([text, prompts]) => ({ words: parseDictionary(text), prompts }));
    pending.catch(() => cache.delete(lang));
    cache.set(lang, pending);
  }
  return pending;
}

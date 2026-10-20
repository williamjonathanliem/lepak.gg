// Precomputes KataBomb prompts: every 2 and 3 letter chunk with how many dictionary
// words contain it. Run after changing a word list:  node scripts/build-prompts.mjs en
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lang = process.argv[2] ?? 'en';
const MIN_WORDS = 50; // chunks rarer than this are never used as prompts
const dir = fileURLToPath(new URL('../public/words/', import.meta.url));

const words = readFileSync(`${dir}${lang}.txt`, 'utf8')
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z]{3,}$/.test(w));

const counts = new Map();
for (const word of words) {
  const seen = new Set();
  for (const len of [2, 3]) {
    for (let i = 0; i + len <= word.length; i++) seen.add(word.slice(i, i + len));
  }
  for (const chunk of seen) counts.set(chunk, (counts.get(chunk) ?? 0) + 1);
}

const prompts = [...counts]
  .filter(([, n]) => n >= MIN_WORDS)
  .sort((a, b) => b[1] - a[1])
  .map(([p, n]) => [p, n]);

writeFileSync(`${dir}${lang}-prompts.json`, JSON.stringify(prompts));
console.log(`${words.length} words -> ${prompts.length} prompts in ${lang}-prompts.json`);

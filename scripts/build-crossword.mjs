// Builds Pocket Crossword puzzles: public/games/crossword.json
//
// Grid: 5 x 5 with black squares at the four inner corners, so there are three words across
// (rows 1, 3, 5) and three down (columns 1, 3, 5), all common 5-letter words from
// Letterlock's answer list. Clues are written once by Gemini at build time and saved here,
// so players never wait on (or pay for) AI.
//
// Run:  node scripts/build-crossword.mjs        (reads GEMINI_API_KEY from .env.local)
// Re-running keeps clues already written (crossword-clues.json) and only asks for new words.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const PUZZLES = 120;

const answersSrc = readFileSync(here('../src/apps/wordl/logic/answers.ts'), 'utf8');
const WORDS = [
  ...new Set(
    answersSrc
      .match(/`([\s\S]*?)`/)[1]
      .split(/\s+/)
      .filter((w) => /^[a-z]{5}$/.test(w)),
  ),
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20260104);
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Down words indexed by their 1st, 3rd and 5th letters (the squares they share with across words).
const byKey = new Map();
for (const w of WORDS) {
  const k = w[0] + w[2] + w[4];
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(w);
}

const puzzles = [];
const usedSets = new Set();
outer: for (const a0 of shuffle(WORDS)) {
  for (const a2 of shuffle(WORDS).slice(0, 120)) {
    if (a2 === a0) continue;
    for (const a4 of shuffle(WORDS).slice(0, 200)) {
      if (a4 === a0 || a4 === a2) continue;
      const downs = [0, 2, 4].map((c) => byKey.get(a0[c] + a2[c] + a4[c]));
      if (downs.some((d) => !d)) continue;
      const pickD = downs.map((d) => shuffle(d)[0]);
      const all = [a0, a2, a4, ...pickD];
      if (new Set(all).size !== 6) continue;
      const key = [...all].sort().join();
      if (usedSets.has(key)) continue;
      usedSets.add(key);
      puzzles.push({ across: [a0, a2, a4], down: pickD });
      if (puzzles.length >= PUZZLES) break outer;
      continue outer; // one grid per first word, for variety
    }
  }
}
console.log(`grids: ${puzzles.length}`);

// ---------- clues ----------
const cluesPath = here('crossword-clues.json');
const clues = existsSync(cluesPath) ? JSON.parse(readFileSync(cluesPath, 'utf8')) : {};
const need = [...new Set(puzzles.flatMap((p) => [...p.across, ...p.down]))].filter(
  (w) => !clues[w],
);
console.log(`words needing clues: ${need.length}`);

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = here('../.env.local');
  if (!existsSync(env)) return null;
  return (
    readFileSync(env, 'utf8')
      .match(/^GEMINI_API_KEY=(.+)$/m)?.[1]
      ?.trim() ?? null
  );
}

async function askClues(batch, key) {
  const prompt =
    'Write a short crossword clue for each word, for students aged 12 and up. ' +
    'Clear and fair, 2 to 7 words, no answer words in the clue, no em dashes, nothing rude or ' +
    'about politics or religion. A little Malaysian flavour is welcome when natural. ' +
    'Answer with JSON only: an object mapping each word to its clue.\nWords: ' +
    batch.join(', ');
  for (const model of ['gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-3.7-flash']) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      },
    );
    if (!res.ok) {
      console.warn(`  ${model}: ${res.status}, trying the next model`);
      continue;
    }
    const body = await res.json();
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    return JSON.parse(text);
  }
  throw new Error('All models busy. Run again in a minute.');
}

if (need.length) {
  const key = apiKey();
  if (!key) {
    console.error('No GEMINI_API_KEY (env or .env.local): cannot write clues.');
    process.exit(1);
  }
  for (let i = 0; i < need.length; i += 40) {
    const batch = need.slice(i, i + 40);
    const got = await askClues(batch, key);
    for (const w of batch) {
      const c = got[w] ?? got[w.toUpperCase()];
      // Keep only sensible clues that don't give the answer away.
      if (
        typeof c === 'string' &&
        c.length >= 3 &&
        c.length <= 60 &&
        !c.toLowerCase().includes(w)
      ) {
        clues[w] = c.replace(/—/g, ',').trim();
      }
    }
    console.log(`  clues: ${Object.keys(clues).length}`);
    writeFileSync(cluesPath, JSON.stringify(clues, null, 1));
  }
}

const ready = puzzles
  .filter((p) => [...p.across, ...p.down].every((w) => clues[w]))
  .map((p) => ({
    across: p.across.map((w) => ({ word: w, clue: clues[w] })),
    down: p.down.map((w) => ({ word: w, clue: clues[w] })),
  }));
writeFileSync(here('../public/games/crossword.json'), JSON.stringify(ready));
console.log(`crossword: ${ready.length} puzzles with clues`);

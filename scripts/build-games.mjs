// Builds the daily puzzles for the word games from our dictionary (public/words/en.txt):
//   public/games/hive.json      Hive Mind: 7 letters (centre first) + every word that fits
//   public/games/edgewise/N.json  Edgewise: 4 sides of 3 letters + a 2-word answer + valid words
// Run after changing the dictionary:  node scripts/build-games.mjs
// Deterministic: the same dictionary always gives the same puzzles in the same order.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const WORDS = readFileSync(`${root}words/en.txt`, 'utf8')
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z]+$/.test(w));

// mulberry32, same as src/lib/puzzle.ts
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
function shuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const bit = (ch) => 1 << (ch.charCodeAt(0) - 97);
const maskOf = (w) => [...w].reduce((m, ch) => m | bit(ch), 0);
const popcount = (m) => m.toString(2).replace(/0/g, '').length;
const lettersOf = (m) => [...'abcdefghijklmnopqrstuvwxyz'].filter((ch) => m & bit(ch)).join('');

mkdirSync(`${root}games`, { recursive: true });

// ---------- Hive Mind ----------
{
  const r = rng(20260101);
  // No S (it makes plurals too easy), like the game it's inspired by.
  const pool = WORDS.filter((w) => w.length >= 4 && !w.includes('s'))
    .map((w) => ({ w, m: maskOf(w) }))
    .filter((x) => popcount(x.m) <= 7);
  const pangramSets = [...new Set(pool.filter((x) => popcount(x.m) === 7).map((x) => x.m))];
  const puzzles = [];
  for (const set of shuffle(pangramSets, r)) {
    if (puzzles.length >= 400) break;
    const letters = lettersOf(set);
    // Try each letter as the centre; keep the one with a friendly number of words.
    let best = null;
    for (const centre of shuffle([...letters], r)) {
      const c = bit(centre);
      const words = pool.filter((x) => (x.m & ~set) === 0 && x.m & c).map((x) => x.w);
      if (
        words.length >= 18 &&
        words.length <= 55 &&
        (!best || Math.abs(words.length - 35) < Math.abs(best.words.length - 35))
      ) {
        best = { centre, words };
      }
    }
    if (!best) continue;
    const others = shuffle(
      [...letters].filter((ch) => ch !== best.centre),
      r,
    ).join('');
    puzzles.push({ letters: best.centre + others, words: best.words.sort() });
  }
  writeFileSync(`${root}games/hive.json`, JSON.stringify(puzzles));
  console.log(`hive: ${puzzles.length} puzzles`);
}

// ---------- Edgewise ----------
{
  const r = rng(20260102);
  const pool = WORDS.filter((w) => w.length >= 3 && w.length <= 12 && !/(.)\1/.test(w));
  const byFirst = new Map();
  for (const w of pool) {
    if (!byFirst.has(w[0])) byFirst.set(w[0], []);
    byFirst.get(w[0]).push(w);
  }
  // Split 12 letters into 4 sides of 3 so no word has two letters from one side in a row.
  function sides(letters, pairs) {
    const side = new Map();
    const count = [0, 0, 0, 0];
    const order = [...letters];
    const clash = (a, s) =>
      pairs.some(([x, y]) => (x === a && side.get(y) === s) || (y === a && side.get(x) === s));
    const go = (i) => {
      if (i === order.length) return true;
      for (let s = 0; s < 4; s++) {
        if (count[s] === 3 || clash(order[i], s)) continue;
        // Symmetry: the first letter always goes on side 0.
        if (i === 0 && s > 0) break;
        side.set(order[i], s);
        count[s]++;
        if (go(i + 1)) return true;
        count[s]--;
        side.delete(order[i]);
      }
      return false;
    };
    if (!go(0)) return null;
    const out = [[], [], [], []];
    for (const [ch, s] of side) out[s].push(ch);
    return out.map((a) => a.join(''));
  }
  const fits = (w, sideOf) => {
    for (let i = 0; i < w.length; i++) {
      if (sideOf[w[i]] === undefined) return false;
      if (i && sideOf[w[i]] === sideOf[w[i - 1]]) return false;
    }
    return true;
  };
  const firsts = shuffle(
    pool.filter((w) => w.length >= 5 && w.length <= 9),
    r,
  );
  const puzzles = [];
  const used = new Set();
  for (const a of firsts) {
    if (puzzles.length >= 150) break;
    const ma = maskOf(a);
    if (popcount(ma) < 5) continue;
    const next = byFirst.get(a[a.length - 1]) ?? [];
    for (const b of shuffle(next, r).slice(0, 400)) {
      if (b.length < 5 || b.length > 9 || b === a) continue;
      const m = ma | maskOf(b);
      if (popcount(m) !== 12 || used.has(m)) continue;
      const letters = lettersOf(m);
      const pairs = [];
      for (const w of [a, b]) for (let i = 1; i < w.length; i++) pairs.push([w[i - 1], w[i]]);
      const s = sides(shuffle([...letters], r).join(''), pairs);
      if (!s) continue;
      const sideOf = {};
      s.forEach((str, k) => [...str].forEach((ch) => (sideOf[ch] = k)));
      const words = pool.filter((w) => (maskOf(w) & ~m) === 0 && fits(w, sideOf));
      if (words.length < 40) continue;
      used.add(m);
      puzzles.push({ sides: shuffle(s, r), answer: [a, b], words });
      break;
    }
  }
  // One small file per puzzle (each carries its word list), plus a count.
  rmSync(`${root}games/edgewise`, { recursive: true, force: true });
  mkdirSync(`${root}games/edgewise`, { recursive: true });
  puzzles.forEach((p, i) => writeFileSync(`${root}games/edgewise/${i}.json`, JSON.stringify(p)));
  writeFileSync(`${root}games/edgewise/count.json`, JSON.stringify({ count: puzzles.length }));
  console.log(`edgewise: ${puzzles.length} puzzles`);
}

// ---------- Word Weave ----------
// Each puzzle: a 6 x 8 grid where the theme words (and the spangram) use every letter.
// How: make a random path through all 48 squares (a "Hamiltonian path", shaken up with
// backbite moves), then cut it into the words in some order. Neighbouring squares on the
// path are next to each other, so every word can be traced. Keep layouts where the
// spangram touches two opposite sides.
{
  const { THEMES } = await import('./weave-themes.mjs');
  const COLS = 6;
  const ROWS = 8;
  const N = COLS * ROWS;
  const r = rng(20260103);
  const nb = (i) => {
    const out = [];
    const rr = Math.floor(i / COLS);
    const cc = i % COLS;
    if (rr > 0) out.push(i - COLS);
    if (rr < ROWS - 1) out.push(i + COLS);
    if (cc > 0) out.push(i - 1);
    if (cc < COLS - 1) out.push(i + 1);
    return out;
  };
  function randomPath() {
    // Start from a snake, then do many backbite moves.
    let path = [];
    for (let rr = 0; rr < ROWS; rr++) {
      for (let k = 0; k < COLS; k++) path.push(rr * COLS + (rr % 2 ? COLS - 1 - k : k));
    }
    for (let step = 0; step < 4000; step++) {
      if (r() < 0.5) path.reverse();
      const end = path[0];
      const options = nb(end).filter((x) => x !== path[1]);
      const x = options[Math.floor(r() * options.length)];
      const k = path.indexOf(x);
      path = [...path.slice(0, k).reverse(), ...path.slice(k)];
    }
    return path;
  }
  // Words (from the theme) whose lengths add up to `target`, 4 to 7 of them.
  function pickWords(words, target) {
    const pool = shuffle(words, r);
    const out = [];
    const go = (i, left) => {
      if (left === 0) return out.length >= 4 && out.length <= 7;
      if (i >= pool.length || left < 0 || out.length >= 7) return false;
      out.push(pool[i]);
      if (go(i + 1, left - pool[i].length)) return true;
      out.pop();
      return go(i + 1, left);
    };
    return go(0, target) ? [...out] : null;
  }
  const touchesOpposite = (cells) => {
    const cols = cells.map((c) => c % COLS);
    const rows = cells.map((c) => Math.floor(c / COLS));
    return (
      (cols.includes(0) && cols.includes(COLS - 1)) || (rows.includes(0) && rows.includes(ROWS - 1))
    );
  };
  const puzzles = [];
  for (let round = 0; round < 3; round++) {
    for (const t of THEMES) {
      const words = pickWords(t.words, N - t.spangram.length);
      if (!words) {
        console.warn(`weave: theme "${t.hint}" can't fill the grid`);
        continue;
      }
      let made = null;
      for (let attempt = 0; attempt < 300 && !made; attempt++) {
        const path = randomPath();
        const order = shuffle([t.spangram, ...words], r);
        const placed = [];
        let at = 0;
        for (const w of order) {
          placed.push({ word: w, cells: path.slice(at, at + w.length) });
          at += w.length;
        }
        const span = placed.find((p) => p.word === t.spangram);
        if (!touchesOpposite(span.cells)) continue;
        // Theme words shouldn't also span the board (only the spangram does).
        if (placed.some((p) => p !== span && touchesOpposite(p.cells) && p.word.length >= COLS))
          continue;
        const grid = new Array(N);
        for (const p of placed) [...p.word].forEach((ch, k) => (grid[p.cells[k]] = ch));
        made = {
          hint: t.hint,
          cols: COLS,
          rows: ROWS,
          grid: grid.join(''),
          spangram: t.spangram,
          words: placed,
        };
      }
      if (made) puzzles.push(made);
    }
  }
  writeFileSync(`${root}games/weave.json`, JSON.stringify(shuffle(puzzles, r)));
  console.log(`weave: ${puzzles.length} puzzles`);
}

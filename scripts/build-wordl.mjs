// Builds the Wordl* guess list: every 5 letter word in the dictionary, one per line.
// Run after changing public/words/en.txt:  node scripts/build-wordl.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/words/', import.meta.url));
const five = readFileSync(`${dir}en.txt`, 'utf8')
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z]{5}$/.test(w));
writeFileSync(`${dir}en-5.txt`, five.join('\n') + '\n');
console.log(`${five.length} five letter words -> en-5.txt`);

// What Ketik Race players type. All written for Lepak.gg (no copied passages).
//   WORDS      everyday English words by length, for word mode and "random words"
//   SENTENCES  short lines for sentence mode
// Pure: same seed, same text, so everyone in a room types the same thing.

import { seededRng, shuffle } from '../../../lib/puzzle';
import { filterText } from '../../../lib/noteFilter';

export const WORDS: Record<number, readonly string[]> = {
  3: 'cat dog sun run fun car bus map pen cup tea egg ice key box art bag bed big boy day ear eye fan fly fox gym hat hot jam joy kid lab leg lip mix mud net nut owl pan pie pin pot rat red sea six sky toy van win yes zip ant bee cow hen pig'.split(
    ' ',
  ),
  4: 'book desk exam note quiz test math word code chat game play team lime rice soup cake milk door wall rain wind moon star fish bird tree road park ship rock song blue gold pink kind fast slow cool warm idea plan time week year love help jump swim walk read talk sing draw lamp sock shoe coat ring kite boat bell'.split(
    ' ',
  ),
  5: 'apple bread chair class clock cloud dance dream earth field fruit grape green happy heart house juice laugh lemon light lunch magic money mouse music night ocean paper party phone piano pizza plant queen quick quiet radio river robot salad smile snake space spoon sport storm study sugar sunny table tiger toast train truck video water whale world write zebra'.split(
    ' ',
  ),
  6: 'animal banana basket bridge butter camera candle carrot castle cheese circle coffee cookie corner dinner doctor dragon friend garden guitar hammer island jacket jungle kitten ladder laptop letter listen market mirror monkey number orange pencil people pepper planet pocket puzzle rabbit rocket school silver sister spider summer tomato travel turtle window winter yellow'.split(
    ' ',
  ),
  7: 'balloon battery bedroom blanket brother cabbage capital chicken cooking cushion diamond dolphin chapter evening example factory feather freedom gallery giraffe holiday kitchen library machine mission morning musical network nothing octopus package pancake harvest penguin picture popcorn concert project rainbow fortune science student sunrise teacher theater thunder village weather welcome'.split(
    ' ',
  ),
  8: 'airplane alphabet backpack birthday building calendar campfire children homework computer dinosaur elephant exercise festival football grateful hospital internet keyboard language marathon mountain notebook painting question shopping skeleton sunshine treasure umbrella vacation sandwich practice triangle'.split(
    ' ',
  ),
  9: 'adventure afternoon astronaut beautiful breakfast celebrate chemistry classroom community crocodile discovery education fireworks chocolate geography happiness important invention knowledge lightning newspaper president scientist spaghetti telephone timetable vegetable waterfall wonderful yesterday'.split(
    ' ',
  ),
};

export const SENTENCES: readonly string[] = [
  'The quiz starts in five minutes, so grab your phone and join the room.',
  'Nasi lemak with extra sambal makes every morning lecture feel shorter.',
  'Our group project is due on Friday, but nobody has opened the slides yet.',
  'The lecturer said the exam is open book, and the whole class cheered.',
  'I wrote my notes on paper, lost them, and then found them in my bag.',
  'Teh tarik first, assignment later, that is the plan for tonight.',
  'The library is quiet until someone drops a water bottle on the floor.',
  'Every great idea starts as a small note in the corner of a notebook.',
  'We split the bill five ways, and somehow I still paid the most.',
  'The wifi in the lecture hall works best if you sit near the door.',
  'Practice a little every day and the hard chapters get easier.',
  'She finished the reading before the tutorial and asked the best question.',
  'My laptop battery died right before I pressed the submit button.',
  'Study for an hour, take a short break, then do it all again.',
  'The canteen sells the best roti canai on campus, ask anyone.',
  'He typed so fast that the keyboard sounded like rain on a roof.',
  'Bring a charger, a pen, and a good attitude to the study session.',
  'The deadline moved to next week, so we have time for one more draft.',
  'A clear plan beats a long night of panic before the exam.',
  'Teamwork means everyone does their part, not just the one who cares.',
  'The bus was late again, so I read my notes at the stop.',
  'Kopi ais in one hand, lecture slides in the other, ready to go.',
  'Good notes have short points, clear headings, and a few examples.',
  'We laughed so loudly in the library that the librarian came over.',
  'Ask questions early, because the answers help everyone in the class.',
  'The robot in the lab can sort colours faster than any of us.',
  'Rain on a Monday morning is the best excuse to stay in bed.',
  'Write the formula first, then put in the numbers one by one.',
  'Our tutor brings snacks on quiz days, which is the real motivation.',
  'Finish strong, check your answers, and then breathe out slowly.',
];

export type TextSource = 'sentences' | 'words' | 'custom';
export type TextLength = 'short' | 'medium' | 'long';

/** Roughly how many characters each length gives. */
const TARGET_CHARS: Record<TextLength, number> = { short: 90, medium: 180, long: 300 };
export const CUSTOM_MAX = 400;

const ALL_WORDS = Object.values(WORDS).flat();

/** The text for a sentence-mode race. Same seed, same text. */
export function raceText(seed: string, source: Exclude<TextSource, 'custom'>, length: TextLength) {
  const rng = seededRng(`${seed}:${source}:${length}`);
  const target = TARGET_CHARS[length];
  if (source === 'sentences') {
    const pool = shuffle([...SENTENCES], rng);
    const out: string[] = [];
    let len = 0;
    for (const s of pool) {
      if (len > 0 && len + s.length > target * 1.25) continue;
      out.push(s);
      len += s.length + 1;
      if (len >= target) break;
    }
    return out.join(' ');
  }
  const out: string[] = [];
  let len = 0;
  while (len < target) {
    const w = ALL_WORDS[Math.floor(rng() * ALL_WORDS.length)]!;
    if (out[out.length - 1] === w) continue;
    out.push(w);
    len += w.length + 1;
  }
  return out.join(' ');
}

/**
 * Text a host pasted in (e.g. a lecturer's vocab list), cleaned for typing: one line,
 * single spaces, plain quotes and dashes, at most CUSTOM_MAX characters ending on a whole
 * word. Null if it's too short to race on or the word filter refuses it.
 */
export function cleanCustom(text: string): string | null {
  let t = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > CUSTOM_MAX) {
    t = t.slice(0, CUSTOM_MAX);
    const cut = t.lastIndexOf(' ');
    if (cut > CUSTOM_MAX / 2) t = t.slice(0, cut);
  }
  if (t.length < 10) return null;
  if (filterText(t) === 'rude') return null;
  return t;
}

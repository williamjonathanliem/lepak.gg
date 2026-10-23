// Art and sound for Ketik Race, in public/games/ketik (Kenney, CC0: see LICENSE.txt there).

import { readStorage, writeStorage } from '../../../lib/storage';

const BASE = '/games/ketik';

export const ANIMALS = [
  'panda',
  'penguin',
  'monkey',
  'rabbit',
  'parrot',
  'pig',
  'elephant',
  'giraffe',
  'hippo',
  'snake',
] as const;
export const avatarSrc = (av: number) => `${BASE}/avatars/${ANIMALS[av % ANIMALS.length]}.png`;
export const animalName = (av: number) => ANIMALS[av % ANIMALS.length]!;

const CARS = ['red', 'blue', 'green', 'yellow', 'black'] as const;
export const carSrc = (lane: number) => `${BASE}/race/car-${CARS[lane % CARS.length]}.png`;

export const RACE = {
  road: `${BASE}/race/road.png`,
  finish: `${BASE}/race/finish.png`,
  tribune: `${BASE}/race/tribune.png`,
  tree: `${BASE}/race/tree.png`,
  tires: `${BASE}/race/tires.png`,
  barrier: `${BASE}/race/barrier.png`,
};

export const SPACE = {
  bg: `${BASE}/space/bg.png`,
  ship: `${BASE}/space/ship.png`,
  laser: `${BASE}/space/laser.png`,
  burst: `${BASE}/space/burst.png`,
  shield: `${BASE}/space/shield.png`,
  fire: `${BASE}/space/fire.png`,
  life: `${BASE}/space/life.png`,
  /** What words ride on: 4 enemy ships, then 4 meteors (matches SPRITES in waves.ts). */
  riders: [1, 2, 3, 4]
    .map((n) => `${BASE}/space/enemy-${n}.png`)
    .concat([1, 2, 3, 4].map((n) => `${BASE}/space/meteor-${n}.png`)),
};

// ---------- sound ----------

export type Sound = 'laser' | 'boom' | 'hit' | 'tick' | 'go' | 'error';
const SOUND_KEY = 'lepak.ketik.sound';
const AVATAR_KEY = 'lepak.ketik.avatar';
const cache = new Map<Sound, HTMLAudioElement>();

export const soundOn = () => readStorage(SOUND_KEY) !== 'off';
export const setSoundOn = (on: boolean) => writeStorage(SOUND_KEY, on ? 'on' : 'off');

/** Plays a short effect (overlapping plays are fine). Silent if sound is off or blocked. */
export function play(name: Sound, volume = 0.5) {
  if (!soundOn()) return;
  try {
    let base = cache.get(name);
    if (!base) {
      base = new Audio(`${BASE}/sfx/${name}.mp3`);
      cache.set(name, base);
    }
    const a = base.cloneNode() as HTMLAudioElement;
    a.volume = volume;
    void a.play().catch(() => {});
  } catch {
    // no audio here: play silently
  }
}

export const savedAvatar = () => {
  const n = Number(readStorage(AVATAR_KEY));
  return Number.isInteger(n) && n >= 0 && n < ANIMALS.length
    ? n
    : Math.floor(Math.random() * ANIMALS.length);
};
export const saveAvatar = (av: number) => writeStorage(AVATAR_KEY, String(av));

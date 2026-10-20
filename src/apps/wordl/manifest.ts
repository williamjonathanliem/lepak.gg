import type { AppManifest } from '../types';

// Working name. "*" names are placeholders for the game they're inspired by; rename before launch.
export const wordl: AppManifest = {
  id: 'wordl',
  number: '011',
  name: 'Wordl*',
  tagline: 'Guess the hidden 5 letter word in 6 tries.',
  category: 'games',
  accent: '#7ee081',
  status: 'beta',
  multiplayer: false,
  route: '/wordl',
  load: () => import('./index'),
};

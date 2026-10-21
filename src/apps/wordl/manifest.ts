import type { AppManifest } from '../types';

export const wordl: AppManifest = {
  id: 'wordl',
  number: '011',
  name: 'Letterlock',
  tagline: 'Guess the hidden 5 letter word in 6 tries. Inspired by NYT’s Wordle.',
  category: 'games',
  accent: '#7ee081',
  status: 'beta',
  multiplayer: false,
  route: '/letterlock',
  load: () => import('./index'),
};

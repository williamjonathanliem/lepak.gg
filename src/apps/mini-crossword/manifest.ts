import type { AppManifest } from '../types';

export const miniCrossword: AppManifest = {
  id: 'mini-crossword',
  number: '015',
  name: 'Pocket Crossword',
  tagline: 'A tiny crossword you can finish before class starts. Inspired by NYT’s Mini Crossword.',
  category: 'games',
  accent: '#ff8fd0',
  status: 'beta',
  multiplayer: false,
  route: '/pocket-crossword',
  load: () => import('./index'),
};

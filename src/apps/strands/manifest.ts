import type { AppManifest } from '../types';

export const strands: AppManifest = {
  id: 'strands',
  number: '013',
  name: 'Word Weave',
  tagline: 'Find the themed words hiding in a letter grid. Inspired by NYT’s Strands.',
  category: 'games',
  accent: '#4fd1e8',
  status: 'beta',
  multiplayer: false,
  route: '/word-weave',
  load: () => import('./index'),
};

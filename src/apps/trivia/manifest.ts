import type { AppManifest } from '../types';

export const trivia: AppManifest = {
  id: 'trivia',
  number: '021',
  name: 'Trivia',
  tagline: '10 quick questions. Answer fast, keep the streak going.',
  category: 'games',
  accent: '#ff8fd0',
  status: 'beta',
  multiplayer: false,
  route: '/trivia',
  load: () => import('./index'),
};

import type { AppManifest } from '../types';

export const pips: AppManifest = {
  id: 'pips',
  number: '018',
  name: 'Domino Logic',
  tagline: 'Place the domino pieces so every rule adds up. Inspired by NYT’s Pips.',
  category: 'games',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: false,
  route: '/domino-logic',
  load: () => import('./index'),
};

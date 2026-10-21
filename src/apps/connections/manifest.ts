import type { AppManifest } from '../types';

export const connections: AppManifest = {
  id: 'connections',
  number: '012',
  name: 'Groupthink',
  tagline: 'Sort 16 words into 4 secret groups. Inspired by NYT’s Connections.',
  category: 'games',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: false,
  route: '/groupthink',
  load: () => import('./index'),
};

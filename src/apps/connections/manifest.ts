import type { AppManifest } from '../types';

// Working name. "*" names are placeholders for the game they're inspired by; rename before launch.
export const connections: AppManifest = {
  id: 'connections',
  number: '012',
  name: 'Connecti*ns',
  tagline: 'Sort 16 words into 4 secret groups.',
  category: 'games',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: false,
  route: '/connections',
  load: () => import('./index'),
};

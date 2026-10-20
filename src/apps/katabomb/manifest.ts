import type { AppManifest } from '../types';

export const katabomb: AppManifest = {
  id: 'katabomb',
  number: '001',
  name: 'KataBomb',
  tagline: 'Type a word with the letters before the bomb pops.',
  category: 'games',
  accent: '#ff7a45',
  status: 'beta',
  badge: 'LIVE FIRST',
  multiplayer: true,
  minPlayers: 2,
  maxPlayers: 8,
  route: '/katabomb',
  load: () => import('./index'),
};

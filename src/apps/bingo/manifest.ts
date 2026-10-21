import type { AppManifest } from '../types';

export const bingo: AppManifest = {
  id: 'bingo',
  number: '024',
  name: 'Bingo',
  tagline: 'Class bingo: numbers or your own vocab words. Projector + phones.',
  category: 'games',
  accent: '#ffd23f',
  status: 'beta',
  multiplayer: true,
  minPlayers: 1,
  maxPlayers: 100,
  route: '/bingo',
  load: () => import('./index'),
};

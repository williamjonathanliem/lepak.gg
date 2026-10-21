import type { AppManifest } from '../types';

export const tiles: AppManifest = {
  id: 'tiles',
  number: '017',
  name: 'Mosaic',
  tagline: 'Match the patterns and clear the board. Inspired by NYT’s Tiles.',
  category: 'games',
  accent: '#7ee081',
  status: 'beta',
  multiplayer: false,
  route: '/mosaic',
  load: () => import('./index'),
};

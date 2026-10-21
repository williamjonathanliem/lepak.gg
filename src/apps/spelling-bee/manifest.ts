import type { AppManifest } from '../types';

export const spellingBee: AppManifest = {
  id: 'spelling-bee',
  number: '014',
  name: 'Hive Mind',
  tagline: 'Make as many words as you can from 7 letters. Inspired by NYT’s Spelling Bee.',
  category: 'games',
  accent: '#ffd23f',
  status: 'beta',
  multiplayer: false,
  route: '/hive-mind',
  load: () => import('./index'),
};

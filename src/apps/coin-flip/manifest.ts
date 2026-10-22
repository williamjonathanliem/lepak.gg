import type { AppManifest } from '../types';

export const coinFlip: AppManifest = {
  id: 'coin-flip',
  number: '027',
  name: 'Coin Flip',
  tagline: 'Heads or tails, best of 3 or 5. Settle it fair and square.',
  category: 'social',
  accent: '#ffd23f',
  status: 'beta',
  multiplayer: false,
  route: '/coin',
  load: () => import('./index'),
};

import type { AppManifest } from '../types';

export const makanSplit: AppManifest = {
  id: 'makan-split',
  number: '007',
  name: 'Makan Split',
  tagline: 'Who ordered what, plus SST and service charge.',
  category: 'social',
  accent: '#ffb86b',
  status: 'beta',
  multiplayer: false,
  route: '/split',
  load: () => import('./index'),
};

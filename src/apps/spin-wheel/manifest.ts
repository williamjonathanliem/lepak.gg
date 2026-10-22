import type { AppManifest } from '../types';

export const spinWheel: AppManifest = {
  id: 'spin-wheel',
  number: '028',
  name: 'Spin the Wheel',
  tagline: 'Makan mana? Who pays? Type the options, spin, done. Share the wheel by link.',
  category: 'social',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: false,
  route: '/wheel',
  load: () => import('./index'),
};

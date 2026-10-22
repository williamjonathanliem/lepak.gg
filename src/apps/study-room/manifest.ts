import type { AppManifest } from '../types';

export const studyRoom: AppManifest = {
  id: 'study-room',
  number: '006',
  name: 'Study Room',
  tagline: 'Shared focus timer. Study apart, feel together.',
  category: 'study',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: true,
  route: '/study',
  load: () => import('./index'),
};

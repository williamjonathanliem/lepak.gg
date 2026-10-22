import type { AppManifest } from '../types';

export const deadlines: AppManifest = {
  id: 'deadlines',
  number: '003',
  name: 'Deadlines',
  tagline: 'Class rep adds it once. The whole class sees the countdown.',
  category: 'study',
  accent: '#ff8fd0',
  status: 'beta',
  multiplayer: true,
  route: '/deadlines',
  load: () => import('./index'),
};

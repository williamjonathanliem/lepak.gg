import type { AppManifest } from '../types';

export const freeTimeFinder: AppManifest = {
  id: 'free-time-finder',
  number: '008',
  name: 'Free-Time Finder',
  tagline: 'Everyone taps free slots. See when the group can meet.',
  category: 'group-work',
  accent: '#4fd1e8',
  status: 'beta',
  multiplayer: true,
  route: '/free',
  load: () => import('./index'),
};

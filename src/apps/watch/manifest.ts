import type { AppManifest } from '../types';

export const watch: AppManifest = {
  id: 'watch',
  number: '025',
  name: 'Watch Together',
  tagline: 'Share your screen with friends. Games, movie nights, revision.',
  category: 'social',
  accent: '#ff8fd0',
  status: 'beta',
  multiplayer: true,
  minPlayers: 2,
  maxPlayers: 7,
  route: '/watch',
  load: () => import('./index'),
};

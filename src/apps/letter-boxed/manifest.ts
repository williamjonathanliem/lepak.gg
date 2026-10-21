import type { AppManifest } from '../types';

export const letterBoxed: AppManifest = {
  id: 'letter-boxed',
  number: '016',
  name: 'Edgewise',
  tagline:
    'Chain words using letters around the sides of a square. Inspired by NYT’s Letter Boxed.',
  category: 'games',
  accent: '#ffb86b',
  status: 'beta',
  multiplayer: false,
  route: '/edgewise',
  load: () => import('./index'),
};

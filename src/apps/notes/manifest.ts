import type { AppManifest } from '../types';

export const notes: AppManifest = {
  id: 'notes',
  number: '002',
  name: 'Notes → Pages',
  tagline: 'Write notes or drop a PDF. Publish it as a page with its own link.',
  category: 'study',
  accent: '#ffd23f',
  status: 'beta',
  multiplayer: false,
  route: '/pages',
  load: () => import('./index'),
};

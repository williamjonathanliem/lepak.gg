import type { AppManifest } from '../types';

export const cite: AppManifest = {
  id: 'cite',
  number: '022',
  name: 'Cite',
  tagline: 'APA 7, MLA and Harvard references. Paste a DOI or ISBN to fill it in.',
  category: 'study',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: false,
  route: '/cite',
  load: () => import('./index'),
};

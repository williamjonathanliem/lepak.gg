import type { AppManifest } from '../types';

export const toolbox: AppManifest = {
  id: 'toolbox',
  number: '023',
  name: 'Toolbox',
  tagline: 'PDF merge, calculator, word counter, unit converter and more. Nothing uploaded.',
  category: 'tools',
  accent: '#7ee081',
  status: 'beta',
  multiplayer: false,
  route: '/tools',
  load: () => import('./index'),
};

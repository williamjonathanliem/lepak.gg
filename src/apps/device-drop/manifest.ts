import type { AppManifest } from '../types';

export const deviceDrop: AppManifest = {
  id: 'device-drop',
  number: '004',
  name: 'Device Drop',
  tagline: 'Phone to laptop, no cable, no WhatsApp-to-self.',
  category: 'tools',
  accent: '#4fd1e8',
  status: 'beta',
  multiplayer: true,
  route: '/drop',
  load: () => import('./index'),
};

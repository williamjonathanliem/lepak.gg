import type { AppManifest } from '../types';

export const whiteboard: AppManifest = {
  id: 'whiteboard',
  number: '020',
  name: 'Whiteboard',
  tagline: 'Draw it out together. Share a code, everyone sketches live.',
  category: 'study',
  accent: '#4fd1e8',
  status: 'beta',
  multiplayer: true,
  maxPlayers: 20,
  route: '/whiteboard',
  load: () => import('./index'),
};

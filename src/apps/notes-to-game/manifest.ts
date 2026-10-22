import type { AppManifest } from '../types';

export const notesToGame: AppManifest = {
  id: 'notes-to-game',
  number: '010',
  name: 'Notes → Game',
  tagline: 'Drop slides or a PDF. AI turns it into a live quiz the whole class plays.',
  category: 'study',
  accent: '#ff8fd0',
  status: 'beta',
  multiplayer: true,
  ai: true,
  minPlayers: 2,
  maxPlayers: 60,
  route: '/notes-game',
  load: () => import('./index'),
};

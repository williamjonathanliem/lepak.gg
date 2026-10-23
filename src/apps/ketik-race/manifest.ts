import type { AppManifest } from '../types';

export const ketikRace: AppManifest = {
  id: 'ketik-race',
  number: '030',
  name: 'Ketik Race',
  tagline: 'Typing race: drive your car with every word, or blast words out of the sky.',
  category: 'games',
  accent: '#ff9f5a',
  status: 'beta',
  multiplayer: true,
  minPlayers: 1,
  maxPlayers: 10,
  route: '/ketik',
  load: () => import('./index'),
};

import type { AppManifest } from '../types';

export const sudokuRace: AppManifest = {
  id: 'sudoku-race',
  number: '029',
  name: 'Sudoku Race',
  tagline: 'Same puzzle, everyone at once. Wrong numbers cost you 30 seconds.',
  category: 'games',
  accent: '#4fd1e8',
  status: 'beta',
  multiplayer: true,
  minPlayers: 1,
  maxPlayers: 30,
  route: '/sudoku-race',
  load: () => import('./index'),
};

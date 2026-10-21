import type { AppManifest } from '../types';

export const sudoku: AppManifest = {
  id: 'sudoku',
  number: '019',
  name: 'Sudoku',
  tagline: 'Classic 9 by 9 number puzzle. A new one every day, easy to hard.',
  category: 'games',
  accent: '#4fd1e8',
  status: 'beta',
  multiplayer: false,
  route: '/sudoku',
  load: () => import('./index'),
};

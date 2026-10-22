import type { AppManifest } from '../types';

export const aiNotes: AppManifest = {
  id: 'ai-notes',
  number: '009',
  name: 'AI Notes',
  tagline:
    'Drop slides or a PDF. Get notes, flashcards that remember, and quizzes with an exam mode.',
  category: 'study',
  accent: '#ffd23f',
  status: 'beta',
  multiplayer: false,
  ai: true,
  route: '/ai-notes',
  load: () => import('./index'),
};

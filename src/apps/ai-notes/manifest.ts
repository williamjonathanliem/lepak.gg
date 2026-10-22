import type { AppManifest } from '../types';

export const aiNotes: AppManifest = {
  id: 'ai-notes',
  number: '009',
  name: 'AI Notes',
  tagline: 'Drop slides, a PDF or a Word file. Get notes, key terms, flashcards and a quiz.',
  category: 'study',
  accent: '#ffd23f',
  status: 'beta',
  multiplayer: false,
  ai: true,
  route: '/ai-notes',
  load: () => import('./index'),
};

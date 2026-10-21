import type { AppManifest } from '../types';

export const aiSlides: AppManifest = {
  id: 'ai-slides',
  number: '026',
  name: 'AI Slides',
  tagline: 'Type a topic or bring your notes. Get slides to present, download or share.',
  category: 'study',
  accent: '#b9a2ff',
  status: 'beta',
  multiplayer: false,
  route: '/ai-slides',
  load: () => import('./index'),
};

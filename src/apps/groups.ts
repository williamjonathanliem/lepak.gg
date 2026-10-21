// How apps are grouped on the hub and the landing page's Index. One list, both pages.
// A new app shows up in its category's group automatically; list it here to place it
// somewhere else.

import { APPS } from './registry';
import type { AppCategory, AppManifest } from './types';

export interface AppGroup {
  id: 'together' | 'daily' | 'study' | 'hangout' | 'tools';
  title: string;
  blurb: string;
  /** Apps placed here on purpose (in this order). */
  ids: string[];
}

export const GROUPS: AppGroup[] = [
  {
    id: 'together',
    title: 'Play together',
    blurb: 'Make a room, drop the code in the group chat.',
    ids: ['katabomb', 'bingo', 'geoguess'],
  },
  {
    id: 'daily',
    title: 'Daily puzzles',
    blurb: 'A new one for everyone at midnight. Keep your streak.',
    ids: [
      'wordl',
      'connections',
      'strands',
      'spelling-bee',
      'mini-crossword',
      'letter-boxed',
      'tiles',
      'pips',
      'sudoku',
      'trivia',
    ],
  },
  {
    id: 'study',
    title: 'Study',
    blurb: 'Notes, slides, citations. The boring bits, faster.',
    ids: ['ai-notes', 'ai-slides', 'notes', 'cite', 'deadlines', 'study-room', 'notes-to-game'],
  },
  {
    id: 'hangout',
    title: 'Hang out',
    blurb: 'Watch, draw and plan together.',
    ids: ['watch', 'whiteboard', 'makan-split', 'free-time-finder'],
  },
  {
    id: 'tools',
    title: 'Tools',
    blurb: 'Small things every project needs.',
    ids: ['toolbox', 'device-drop'],
  },
];

/** Where an app not listed above goes, by its category. */
const FALLBACK: Record<AppCategory, AppGroup['id']> = {
  games: 'daily',
  study: 'study',
  tools: 'tools',
  social: 'hangout',
  'group-work': 'hangout',
};

export function groupOf(app: AppManifest): AppGroup['id'] {
  return GROUPS.find((g) => g.ids.includes(app.id))?.id ?? FALLBACK[app.category];
}

/** Each group with its apps: listed ones first (in order), then any others. */
export function groupedApps(apps: readonly AppManifest[] = APPS) {
  return GROUPS.map((g) => {
    const mine = apps.filter((a) => groupOf(a) === g.id);
    const rank = (a: AppManifest) => {
      const i = g.ids.indexOf(a.id);
      return i < 0 ? 999 : i;
    };
    return { ...g, apps: [...mine].sort((a, b) => rank(a) - rank(b)) };
  });
}

/** Apps you can join with a room code, and where the code goes. */
export const JOINABLE: { id: string; name: string; path: (code: string) => string }[] = [
  { id: 'katabomb', name: 'KataBomb', path: (c) => `/katabomb/r/${c}` },
  { id: 'bingo', name: 'Bingo', path: (c) => `/bingo/r/${c}` },
  { id: 'watch', name: 'Watch Together', path: (c) => `/watch/r/${c}` },
  { id: 'whiteboard', name: 'Whiteboard', path: (c) => `/whiteboard/r/${c}` },
  { id: 'device-drop', name: 'Device Drop', path: (c) => `/drop/r/${c}` },
];

/** Short line under an app's name: who it's for. */
export function playersLabel(app: AppManifest): string {
  const group = groupOf(app);
  if (group === 'daily') return app.id === 'trivia' ? 'Solo, quick' : 'Daily puzzle';
  if (app.id === 'device-drop') return 'Your devices';
  if (app.multiplayer && app.minPlayers && app.maxPlayers) {
    return `${app.minPlayers} to ${app.maxPlayers} people`;
  }
  if (app.multiplayer) return 'With friends';
  return 'Just you';
}

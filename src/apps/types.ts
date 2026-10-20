import type { ComponentType } from 'react';

export type AppCategory = 'games' | 'study' | 'tools' | 'social' | 'group-work';

export const CATEGORY_LABEL: Record<AppCategory, string> = {
  games: 'Games',
  study: 'Study',
  tools: 'Tools',
  social: 'Social',
  'group-work': 'Group work',
};

interface BaseManifest {
  id: string; // 'katabomb'
  number: string; // '001', shown in the brutalist index
  name: string; // 'KataBomb'
  tagline: string; // one line for the grid card
  category: AppCategory;
  multiplayer: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  /** Optional tag that replaces the category on the card, e.g. 'LIVE FIRST'. */
  badge?: string;
  /** The app's one accent colour. Must keep black text readable (contrast 7:1+). */
  accent: string;
}

/** Planned apps show as "coming soon" cards and have no route yet. */
export interface PlannedAppManifest extends BaseManifest {
  status: 'planned';
}

export interface RoutedAppManifest extends BaseManifest {
  status: 'live' | 'beta';
  route: string; // '/katabomb'
  load: () => Promise<{ default: ComponentType }>; // lazy import
}

export type AppManifest = PlannedAppManifest | RoutedAppManifest;

export function isRouted(app: AppManifest): app is RoutedAppManifest {
  return app.status !== 'planned';
}

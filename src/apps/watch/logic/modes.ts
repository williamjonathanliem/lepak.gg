// Sharing modes for Watch Together. Each one trades sharpness against smoothness.
// The browser still adapts on top of these when a connection is struggling.

export type Mode = 'game' | 'movie' | 'slides';

export interface ModeSettings {
  label: string;
  hint: string;
  /** Frames per second we ask the screen capture for. */
  fps: number;
  /** Tallest picture we ask for. */
  height: number;
  /** Cap per viewer, bits per second. Lower = less lag on slow uploads. */
  maxBitrate: number;
  /** Tells the encoder what matters: smooth motion, or crisp detail (text). */
  contentHint: 'motion' | 'detail' | 'text';
  audioHint: 'music' | 'speech';
}

export const MODES: Record<Mode, ModeSettings> = {
  game: {
    label: 'Game',
    hint: 'Smooth and fast. 720p, up to 60 fps.',
    fps: 60,
    height: 720,
    maxBitrate: 2_500_000,
    contentHint: 'motion',
    audioHint: 'music',
  },
  movie: {
    label: 'Movie',
    hint: 'Sharper picture, good sound. 1080p, 30 fps.',
    fps: 30,
    height: 1080,
    maxBitrate: 3_000_000,
    contentHint: 'motion',
    audioHint: 'music',
  },
  slides: {
    label: 'Slides',
    hint: 'Crisp text, low data. Best for notes and code.',
    fps: 8,
    height: 1080,
    maxBitrate: 1_200_000,
    contentHint: 'text',
    audioHint: 'speech',
  },
};

export const MAX_VIEWERS = 6;

/**
 * Bitrate per viewer: the host's upload is shared by everyone watching, so with more
 * viewers each one gets a bit less (never below a third of the mode's cap).
 */
export function bitrateFor(mode: Mode, viewers: number): number {
  const cap = MODES[mode].maxBitrate;
  if (viewers <= 2) return cap;
  return Math.round(Math.max(cap / 3, cap * (2 / viewers)));
}

import type { CSSProperties, ReactNode } from 'react';

// Hand-drawn marker doodles. Stroke uses currentColor, so they follow text colour
// (and invert with hover cells). Each path "draws itself" once on load; reduced motion
// skips straight to the finished drawing.

export type DoodleName =
  | 'arrow-curl'
  | 'arrow-down'
  | 'sparkle'
  | 'squiggle'
  | 'bomb'
  | 'kopi'
  | 'heart'
  | 'smiley'
  | 'scribble-circle';

interface Shape {
  viewBox: string;
  paths: string[];
}

const SHAPES: Record<DoodleName, Shape> = {
  'arrow-curl': {
    viewBox: '0 0 100 70',
    paths: [
      'M4 12 C 30 2, 62 4, 66 24 C 70 44, 44 52, 40 38 C 36 24, 62 20, 74 34 C 82 44, 86 54, 88 62',
      'M78 56 L 88 63 L 93 51',
    ],
  },
  'arrow-down': {
    viewBox: '0 0 60 90',
    paths: ['M30 4 C 18 24, 42 40, 28 62 C 24 70, 26 76, 30 84', 'M20 74 L 30 85 L 40 73'],
  },
  sparkle: {
    viewBox: '0 0 40 40',
    paths: [
      'M20 3 C 21 14, 24 18, 37 20 C 24 22, 21 26, 20 37 C 19 26, 16 22, 3 20 C 16 18, 19 14, 20 3 Z',
    ],
  },
  squiggle: {
    viewBox: '0 0 160 20',
    paths: [
      'M3 12 C 15 2, 25 2, 33 11 S 52 20, 62 10 S 82 1, 92 10 S 112 19, 122 10 S 142 2, 157 9',
    ],
  },
  bomb: {
    viewBox: '0 0 80 80',
    paths: [
      'M34 26 C 18 26, 8 38, 9 52 C 10 66, 22 75, 36 74 C 52 73, 62 61, 60 47 C 58 34, 48 26, 34 26 Z',
      'M29 24 L 31 17 L 42 19 L 41 27',
      'M37 18 C 40 9, 50 8, 54 13 C 57 17, 60 14, 61 10',
      'M64 6 L 66 1 M 68 10 L 74 8 M 66 14 L 71 18',
      'M20 46 C 21 40, 25 36, 30 35',
    ],
  },
  kopi: {
    viewBox: '0 0 80 90',
    paths: [
      'M14 36 L 20 82 C 21 86, 51 86, 52 82 L 58 36 Z',
      'M10 36 L 62 36',
      'M57 48 C 70 46, 72 66, 54 68',
      'M26 28 C 22 22, 30 18, 26 10',
      'M38 28 C 34 22, 42 18, 38 8',
      'M50 28 C 46 22, 54 18, 50 12',
    ],
  },
  heart: {
    viewBox: '0 0 50 46',
    paths: [
      'M25 42 C 6 30, 2 18, 8 10 C 14 3, 23 6, 25 14 C 27 6, 37 2, 43 10 C 49 19, 43 31, 25 42 Z',
    ],
  },
  smiley: {
    viewBox: '0 0 70 70',
    paths: [
      'M35 4 C 16 4, 4 18, 5 36 C 6 54, 20 66, 37 65 C 54 64, 66 51, 65 34 C 64 17, 51 5, 33 6',
      'M24 26 L 24 30',
      'M46 26 L 46 30',
      'M20 42 C 26 54, 44 54, 50 42',
    ],
  },
  'scribble-circle': {
    viewBox: '0 0 200 80',
    paths: [
      'M108 8 C 60 2, 10 14, 8 40 C 6 64, 60 76, 110 72 C 160 68, 194 54, 192 34 C 190 14, 150 4, 100 8 C 70 10, 40 16, 30 24',
    ],
  },
};

interface DoodleProps {
  name: DoodleName;
  className?: string;
  /** Stroke width in viewBox units. */
  stroke?: number;
  /** Seconds before the draw-on animation starts. */
  delay?: number;
  /** Fill closed shapes (sparkle, heart) instead of outlining them. */
  filled?: boolean;
  style?: CSSProperties;
}

export function Doodle({
  name,
  className = '',
  stroke = 3,
  delay = 0,
  filled,
  style,
}: DoodleProps) {
  const shape = SHAPES[name];
  return (
    <svg
      aria-hidden="true"
      viewBox={shape.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`doodle pointer-events-none ${className}`}
      style={{ ...style, ['--draw-delay' as string]: `${delay}s` }}
    >
      {shape.paths.map((d, i) => (
        <path key={i} d={d} pathLength={1} fill={filled && i === 0 ? 'currentColor' : 'none'} />
      ))}
    </svg>
  );
}

interface HandNoteProps {
  children: ReactNode;
  className?: string;
  /** Rotation in degrees. */
  rotate?: number;
}

/** Handwritten margin note. Decorative: repeat anything important in real text. */
export function HandNote({ children, className = '', rotate = -4 }: HandNoteProps) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block font-hand text-2xl leading-none font-bold ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

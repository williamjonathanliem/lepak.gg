import type { ReactNode } from 'react';

type Variant = 'light' | 'dark' | 'round';

const VARIANTS: Record<Variant, string> = {
  light: 'border-3 border-ink bg-paper px-3.5 py-2 text-sm shadow-hard-sm',
  dark: 'border-3 border-ink bg-ink px-3.5 py-2 text-sm text-paper',
  round:
    'flex size-23 items-center justify-center rounded-full border-3 border-ink bg-paper text-center text-xs leading-[1.15]',
};

interface StickerProps {
  variant?: Variant;
  /** Rotation in degrees. */
  rotate?: number;
  /** Gently float up and down. Stops for reduced motion. */
  bob?: boolean;
  /** Seconds to offset the bob so neighbouring stickers don't move in sync. */
  bobDelay?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Decorative rotated label that straightens up when you hover it.
 * Hide it from screen readers at the call site.
 */
export function Sticker({
  variant = 'light',
  rotate = 0,
  bob = false,
  bobDelay = 0,
  className = '',
  children,
}: StickerProps) {
  return (
    <div
      className={`font-mono font-bold transition-[rotate,scale] duration-200 hover:scale-110 hover:rotate-0! ${bob ? 'animate-bob' : ''} ${VARIANTS[variant]} ${className}`}
      style={{ rotate: `${rotate}deg`, animationDelay: `${bobDelay}s` }}
    >
      {children}
    </div>
  );
}

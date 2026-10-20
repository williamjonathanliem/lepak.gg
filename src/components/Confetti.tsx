import { useReducedMotion } from '../lib/useReducedMotion';

/** Stable pseudo-random number in [0, 1) for piece i, property k. Pure, so it's safe in render. */
function rand(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS = ['#ff4a1c', '#ffd23f', '#7ee081', '#4fd1e8', '#ff8fd0', '#b9a2ff', '#f9fafb'];

/** A one-off burst of falling paper squares. Skipped entirely for reduced motion. */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const reduced = useReducedMotion();
  const bits = Array.from({ length: pieces }, (_, i) => ({
    id: i,
    left: rand(i, 1) * 100,
    size: 6 + rand(i, 2) * 8,
    color: COLORS[i % COLORS.length]!,
    fall: 2.2 + rand(i, 3) * 1.6,
    delay: rand(i, 4) * 0.6,
    drift: (rand(i, 5) - 0.5) * 160,
  }));
  if (reduced) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-0 block animate-confetti"
          style={
            {
              left: `${b.left}%`,
              width: b.size,
              height: b.size * 0.6,
              background: b.color,
              '--fall': `${b.fall}s`,
              '--delay': `${b.delay}s`,
              '--drift': `${b.drift}px`,
              translate: '0 -10vh',
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

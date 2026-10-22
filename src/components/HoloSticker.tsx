import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

// A round holographic sticker: rainbow foil and a glare that follow the mouse (the sticker
// tilts a little toward you), a corner that peels up on hover, and a slow shimmer by
// itself on touch screens. No images, no library: layered gradients (see .holo in
// styles/index.css). Decorative: hide it from screen readers where it's used.

interface Props {
  children: ReactNode;
  /** Small line under the main text. */
  sub?: ReactNode;
  /** Resting rotation in degrees. */
  rotate?: number;
  className?: string;
}

export function HoloSticker({ children, sub, rotate = -8, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0..1
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    el.style.setProperty('--ry', `${((x - 0.5) * 24).toFixed(1)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 24).toFixed(1)}deg`);
    el.style.setProperty('--angle', `${(x * 180 + y * 90).toFixed(0)}deg`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    for (const k of ['--mx', '--my', '--rx', '--ry', '--angle']) el.style.removeProperty(k);
  }

  return (
    <div
      ref={ref}
      className={`holo ${className}`}
      style={{ '--rot': `${rotate}deg` } as CSSProperties}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className="holo-face">
        <span className="holo-foil" />
        <span className="holo-glare" />
        <span className="holo-text">
          <span className="holo-main">{children}</span>
          {sub && <span className="holo-sub">{sub}</span>}
        </span>
      </div>
      {/* the peeled-up corner, showing the sticker's paper back */}
      <span className="holo-peel" />
    </div>
  );
}

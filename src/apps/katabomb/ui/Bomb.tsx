// The ticking bomb. The fuse burns down from the tip as the turn runs out,
// with a flickering spark at the burning end. Drawn in SVG, no image files.

const FUSE = { x0: 138, y0: 46, cx: 168, cy: 44, x1: 180, y1: 10 };

/** Point on the fuse curve at t (0 = at the bomb, 1 = at the tip). */
function fusePoint(t: number) {
  const { x0, y0, cx, cy, x1, y1 } = FUSE;
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

interface BombProps {
  /** How much fuse is left, 1 = full, 0 = boom. */
  fraction: number;
  danger: boolean;
  className?: string;
}

export function Bomb({ fraction, danger, className = '' }: BombProps) {
  const f = Math.max(0, Math.min(1, fraction));
  const spark = fusePoint(f);
  const { x0, y0, cx, cy, x1, y1 } = FUSE;

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={`overflow-visible ${danger ? 'animate-wobble' : ''} ${className}`}
    >
      {/* fuse: grey burnt-out guide + white remaining part */}
      <path
        d={`M${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`}
        fill="none"
        stroke="#f9fafb"
        strokeOpacity="0.15"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={`M${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`}
        fill="none"
        stroke="#f9fafb"
        strokeWidth="6"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${f} 1`}
      />
      {/* cap */}
      <rect
        x="114"
        y="40"
        width="34"
        height="26"
        transform="rotate(35 131 53)"
        fill="#000"
        stroke="#f9fafb"
        strokeWidth="5"
      />
      {/* body */}
      <circle cx="94" cy="120" r="64" fill="#000" stroke="#f9fafb" strokeWidth="5" />
      <path
        d="M58 98 C 64 80, 78 70, 94 68"
        fill="none"
        stroke="#f9fafb"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* spark at the burning end */}
      {f > 0 && (
        <g transform={`translate(${spark.x} ${spark.y})`}>
          <g className="origin-center animate-spark [transform-box:fill-box]">
            <path
              d="M0 -18 L5 -6 L18 -6 L8 2 L12 15 L0 7 L-12 15 L-8 2 L-18 -6 L-5 -6 Z"
              fill="var(--color-hot)"
            />
            <circle r="5" fill="#f9fafb" />
          </g>
        </g>
      )}
    </svg>
  );
}

import type { Standing } from '../logic/race';
import { RACE, avatarSrc, carSrc } from './assets';

// The race track for sentence mode, seen from above: tribunes along the top, one road lane
// per racer, a chequered finish on the right, trees along the bottom. Each car drives as
// its racer types. Lanes keep their order (by who joined), so cars never jump lanes.

const NAME_COL = 'clamp(84px, 22vw, 150px)';

export function Track({
  rows,
  laneOrder,
  selfId,
  big = false,
}: {
  rows: Standing[];
  /** Racer ids in lane order. */
  laneOrder: string[];
  selfId: string;
  big?: boolean;
}) {
  const lane = big ? 72 : 52;
  const byId = new Map(rows.map((r) => [r.uid, r]));
  const lanes = laneOrder.map((id) => byId.get(id)).filter((r): r is Standing => !!r);

  return (
    <div className="overflow-hidden border-3 border-ink bg-[#6abe5e]" aria-label="Race track">
      {/* tribunes */}
      <div
        aria-hidden="true"
        className="h-10 border-b-3 border-ink bg-repeat-x"
        style={{ backgroundImage: `url(${RACE.tribune})`, backgroundSize: 'auto 40px' }}
      />
      <ol className="m-0 list-none p-0">
        {lanes.map((r, i) => (
          <li
            key={r.uid}
            className="grid items-stretch"
            style={{ gridTemplateColumns: `${NAME_COL} 1fr`, height: lane }}
          >
            <div
              className={`flex min-w-0 items-center gap-1.5 border-r-3 border-ink px-1.5 ${r.uid === selfId ? 'bg-ink text-paper' : 'bg-paper'}`}
            >
              <img
                src={avatarSrc(r.av)}
                alt=""
                className="shrink-0"
                style={{ height: lane * 0.62 }}
              />
              <span
                className={`min-w-0 truncate font-mono font-bold ${big ? 'text-base' : 'text-xs'}`}
              >
                {r.nick}
              </span>
              {r.timeMs !== null && (
                <span
                  className={`ml-auto shrink-0 border-2 border-current px-1 font-mono font-bold ${big ? 'text-base' : 'text-[11px]'}`}
                >
                  #{r.place}
                </span>
              )}
            </div>
            <div
              className="relative bg-repeat-x"
              style={{ backgroundImage: `url(${RACE.road})`, backgroundSize: `auto ${lane}px` }}
            >
              {/* finish line: a black and white chequer */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 right-6 w-4 border-x-2 border-ink"
                style={{
                  background: 'repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0 / 8px 8px',
                }}
              />
              <img
                src={carSrc(i)}
                alt=""
                className="absolute top-1/2 transition-[left] duration-300 ease-out motion-reduce:transition-none"
                style={{
                  // the car's length (it's drawn pointing up, then turned)
                  height: lane * 0.85,
                  // cars face up in the art: turn them to drive right
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                  left: `calc(${lane * 0.5}px + ${r.progress} * (100% - ${lane * 0.5 + 44}px))`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      {/* trees and tyres */}
      <div
        aria-hidden="true"
        className="h-9 border-t-3 border-ink bg-repeat-x"
        style={{
          backgroundImage: `url(${RACE.tree}), url(${RACE.tires})`,
          backgroundSize: '36px 36px, 22px 22px',
          backgroundPosition: '0 0, 40px 7px',
          backgroundRepeat: 'repeat-x',
        }}
      />
      {lanes.length === 0 && (
        <p className="m-0 bg-paper p-4 font-mono text-sm">Nobody is racing yet.</p>
      )}
    </div>
  );
}

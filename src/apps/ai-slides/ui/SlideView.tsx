import type { Slide, Theme } from '../logic/deck';

// One slide, drawn at 16:9. Sizes are in cqw (percent of the slide's width), so the same
// slide looks right as a thumbnail, in the editor and full screen.

interface Props {
  slide: Slide;
  theme: Theme;
  index: number;
  total: number;
  className?: string;
}

export function SlideView({ slide, theme, index, total, className = '' }: Props) {
  const s = slide;
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden font-sans [container-type:inline-size] ${className}`}
      style={{ background: theme.bg, color: theme.fg }}
    >
      <div className="absolute inset-0 flex flex-col p-[6cqw]">
        {s.layout === 'title' && (
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-[2.5cqw] h-[1cqw] w-[10cqw]" style={{ background: theme.accent }} />
            <h2 className="m-0 text-[6.5cqw] leading-[1.02] font-black tracking-[-0.03em]">
              {s.title}
            </h2>
            {s.subtitle && (
              <p className="mt-[2cqw] mb-0 text-[2.6cqw]" style={{ color: theme.muted }}>
                {s.subtitle}
              </p>
            )}
          </div>
        )}

        {s.layout === 'section' && (
          <div className="flex flex-1 items-center gap-[3cqw]">
            <div className="h-[22cqw] w-[2cqw] shrink-0" style={{ background: theme.accent }} />
            <div>
              <h2 className="m-0 text-[5.5cqw] leading-[1.05] font-black tracking-[-0.03em]">
                {s.title}
              </h2>
              {s.subtitle && (
                <p className="mt-[1.5cqw] mb-0 text-[2.4cqw]" style={{ color: theme.muted }}>
                  {s.subtitle}
                </p>
              )}
            </div>
          </div>
        )}

        {(s.layout === 'bullets' ||
          s.layout === 'two-column' ||
          s.layout === 'timeline' ||
          s.layout === 'cards') && (
          <h2 className="m-0 mb-[3cqw] text-[4cqw] leading-[1.1] font-black tracking-[-0.02em]">
            {s.title}
          </h2>
        )}

        {s.layout === 'bullets' && <Bullets items={s.bullets ?? []} theme={theme} size="2.5cqw" />}

        {s.layout === 'two-column' && (
          <div className="grid flex-1 grid-cols-2 gap-[4cqw]">
            {[
              [s.leftTitle, s.left],
              [s.rightTitle, s.right],
            ].map(([head, items], k) => (
              <div key={k}>
                {head && (
                  <p
                    className="mt-0 mb-[1.5cqw] border-b-[0.35cqw] pb-[0.8cqw] text-[2.6cqw] font-black"
                    style={{ borderColor: theme.accent }}
                  >
                    {head as string}
                  </p>
                )}
                <Bullets
                  items={(items as string[] | undefined) ?? []}
                  theme={theme}
                  size="2.2cqw"
                />
              </div>
            ))}
          </div>
        )}

        {s.layout === 'timeline' && <Timeline steps={s.steps ?? []} theme={theme} />}

        {s.layout === 'cards' && (
          <div
            className={`grid flex-1 content-center gap-[2cqw] ${(s.cards?.length ?? 0) === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}
          >
            {(s.cards ?? []).map((c, k) => (
              <div
                key={k}
                className="flex flex-col gap-[0.8cqw] border-t-[0.6cqw] p-[1.8cqw]"
                style={{
                  borderColor: theme.accent,
                  background: `color-mix(in srgb, ${theme.fg} 6%, ${theme.bg})`,
                }}
              >
                <p className="m-0 text-[2.4cqw] leading-tight font-black">{c.title}</p>
                <p className="m-0 text-[1.8cqw] leading-snug" style={{ color: theme.muted }}>
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {s.layout === 'quote' && (
          <div className="flex flex-1 flex-col justify-center">
            <p
              aria-hidden="true"
              className="m-0 h-[7cqw] text-[14cqw] leading-none font-black"
              style={{ color: theme.accent }}
            >
              “
            </p>
            <blockquote className="m-0 text-[3.8cqw] leading-[1.25] font-bold">
              {s.quote ?? s.title}
            </blockquote>
            {s.author && (
              <p className="mt-[2cqw] mb-0 text-[2.2cqw]" style={{ color: theme.muted }}>
                {s.author}
              </p>
            )}
          </div>
        )}

        {s.layout === 'big-number' && (
          <div className="flex flex-1 flex-col justify-center">
            <p className="m-0 text-[2.6cqw] font-bold" style={{ color: theme.muted }}>
              {s.title}
            </p>
            <p className="m-0 text-[15cqw] leading-none font-black tracking-[-0.04em]">
              {s.number}
            </p>
            <div
              className="my-[1.5cqw] h-[0.8cqw] w-[14cqw]"
              style={{ background: theme.accent }}
            />
            {s.numberLabel && <p className="m-0 text-[2.8cqw]">{s.numberLabel}</p>}
          </div>
        )}
      </div>
      <span
        className="absolute right-[2.5cqw] bottom-[2cqw] font-mono text-[1.3cqw]"
        style={{ color: theme.muted }}
      >
        {index + 1} / {total}
      </span>
    </div>
  );
}

function Bullets({ items, theme, size }: { items: string[]; theme: Theme; size: string }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-[1.6cqw] p-0" style={{ fontSize: size }}>
      {items.map((b, i) => (
        <li key={i} className="flex gap-[1.5cqw] leading-[1.3]">
          <span
            aria-hidden="true"
            className="mt-[0.45em] size-[0.55em] shrink-0"
            style={{ background: theme.accent }}
          />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

/** Steps along a line: across for up to 5 steps, down the slide for more. */
function Timeline({ steps, theme }: { steps: { label: string; text: string }[]; theme: Theme }) {
  if (steps.length > 5) {
    return (
      <ol className="m-0 flex list-none flex-col gap-[1.2cqw] p-0">
        {steps.map((st, k) => (
          <li key={k} className="flex items-baseline gap-[2cqw] text-[1.9cqw]">
            <span
              className="w-[14cqw] shrink-0 text-right font-black"
              style={{ color: theme.muted }}
            >
              {st.label}
            </span>
            <span
              aria-hidden="true"
              className="size-[1.2cqw] shrink-0 rounded-full"
              style={{ background: theme.accent }}
            />
            <span>{st.text}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <div
        aria-hidden="true"
        className="absolute right-0 left-0 h-[0.4cqw]"
        style={{ background: theme.accent, top: 'calc(50% - 0.2cqw)' }}
      />
      <ol
        className="relative m-0 grid list-none gap-[2cqw] p-0"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, 1fr)` }}
      >
        {steps.map((st, k) => (
          <li key={k} className="flex flex-col items-start">
            <p className="m-0 mb-[1.5cqw] min-h-[3cqw] text-[2.2cqw] font-black">{st.label}</p>
            <span
              aria-hidden="true"
              className="mb-[1.5cqw] size-[2cqw] rounded-full border-[0.4cqw]"
              style={{ background: theme.bg, borderColor: theme.accent }}
            />
            <p className="m-0 text-[1.8cqw] leading-snug" style={{ color: theme.muted }}>
              {st.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { CATEGORY_LABEL, type AppManifest } from '../apps/types';

interface IndexCardProps {
  app: AppManifest;
  /** Where the card goes. Route paths use the router, "#hash" uses a plain link. No href: not clickable. */
  href?: string;
  /** Decorative doodle in the empty top-right area. */
  doodle?: ReactNode;
  /** Small control at the bottom of the card, e.g. a vote button. */
  action?: ReactNode;
}

const CARD =
  'cell relative flex min-h-60 flex-col justify-between gap-6 bg-paper px-[clamp(16px,2.5vw,28px)] py-7 text-ink no-underline';

/** One cell of The Index grid. Hover and focus fill it with the app's accent colour. */
export function IndexCard({ app, href, doodle, action }: IndexCardProps) {
  const tag = app.badge ?? CATEGORY_LABEL[app.category];
  const style = {
    '--accent': app.accent,
    '--accent-text': 'var(--color-ink)',
    '--accent-dim': '#1a1a1a',
  } as CSSProperties;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3 font-mono text-[13px]">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-3 border-2 border-ink"
            style={{ background: app.accent }}
          />
          {app.number}
        </span>
        <span className={app.badge ? 'border-2 border-current px-2 py-0.5 font-bold' : 'uppercase'}>
          {tag}
        </span>
      </div>
      <div>
        <h3 className="m-0 text-[34px] leading-[0.95] font-black tracking-[-0.03em] uppercase">
          {app.name}
        </h3>
        <p className="cell-dim m-0 mt-2.5 text-[15px] text-mute">{app.tagline}</p>
        {app.status === 'planned' && <span className="sr-only">Coming soon.</span>}
        {action && <div className="mt-4">{action}</div>}
      </div>
      {doodle && <div className="absolute top-14 right-5 sm:right-7">{doodle}</div>}
    </>
  );

  if (!href)
    return (
      <article className={CARD} style={style}>
        {body}
      </article>
    );
  if (href.startsWith('/'))
    return (
      <Link to={href} className={CARD} style={style}>
        {body}
      </Link>
    );
  return (
    <a href={href} className={CARD} style={style}>
      {body}
    </a>
  );
}

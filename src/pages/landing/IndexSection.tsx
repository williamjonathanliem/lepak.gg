import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { groupedApps } from '../../apps/groups';
import { ROUTED_APPS } from '../../apps/registry';
import type { AppManifest } from '../../apps/types';
import { Doodle, HandNote } from '../../components/Doodle';
import { SectionLabel } from '../../components/SectionLabel';
import { INDEX } from '../../copy/landing';

// The Index: every app on one page, like the index at the back of a book. Grouped (Play
// together, Daily puzzles, Study...), one row per app. Live apps link straight in; planned
// ones are listed so people can see what's coming.

/** Rows shown per group before "+ N more", so the page stays short as apps are added. */
const PREVIEW = 4;

export function IndexSection() {
  // Live apps first in each group, then the ones on the way.
  const groups = groupedApps().map((g) => ({
    ...g,
    apps: [...g.apps].sort(
      (a, b) => Number(a.status === 'planned') - Number(b.status === 'planned'),
    ),
  }));
  const live = ROUTED_APPS.length;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section id="index" aria-labelledby="index-heading" className="border-b-3 border-ink">
      <div className="flex flex-wrap items-end justify-between gap-4 px-gutter pt-[clamp(48px,6vw,80px)] pb-8">
        <div className="relative">
          <h2 id="index-heading" className="heading-xl m-0">
            {INDEX.heading[0]}
            <br />
            {INDEX.heading[1]}
          </h2>
          <div className="pointer-events-none absolute bottom-0 left-full z-10 ml-4 flex flex-col items-start max-sm:hidden">
            <HandNote rotate={-6}>{INDEX.note}</HandNote>
            <Doodle
              name="arrow-down"
              delay={0.4}
              className="-mb-16 ml-2 h-20 w-10 rotate-[25deg]"
            />
          </div>
        </div>
        <div className="m-0 max-w-[380px] font-mono text-sm">
          <SectionLabel number="003" title={INDEX.label} className="block" />
          <p className="m-0">{INDEX.blurb}</p>
          <p className="mt-3 mb-0 font-bold">
            {INDEX.counts(live, groups.flatMap((g) => g.apps).length - live)}
          </p>
        </div>
      </div>

      {/* Groups flow into columns; each keeps together. Grid lines from the black gaps. */}
      <div className="columns-1 gap-[3px] border-t-3 border-ink bg-ink md:columns-2 xl:columns-3">
        {groups.map((g) => (
          <section
            key={g.id}
            aria-labelledby={`idx-${g.id}`}
            className="mb-[3px] break-inside-avoid bg-paper"
          >
            <header className="flex items-baseline justify-between gap-3 border-b-3 border-ink bg-ink px-gutter py-3 text-paper">
              <h3
                id={`idx-${g.id}`}
                className="m-0 text-[clamp(22px,2.6vw,30px)] leading-none font-black tracking-[-0.02em] uppercase"
              >
                {g.title}
              </h3>
              <span className="font-mono text-xs text-mute-dark">{g.apps.length}</span>
            </header>
            <p className="m-0 border-b-2 border-ink/15 px-gutter py-2 font-mono text-xs text-mute">
              {g.blurb}
            </p>
            <ul id={`idx-list-${g.id}`} className="m-0 list-none p-0">
              {(open.has(g.id) ? g.apps : g.apps.slice(0, PREVIEW)).map((app) => (
                <li key={app.id} className="border-b-2 border-ink/15 last:border-b-0">
                  <Row app={app} />
                </li>
              ))}
            </ul>
            {g.apps.length > PREVIEW && (
              <button
                type="button"
                aria-expanded={open.has(g.id)}
                aria-controls={`idx-list-${g.id}`}
                onClick={() => toggle(g.id)}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between border-0 border-t-3 border-ink bg-paper px-gutter font-mono text-sm font-bold uppercase hover:bg-ink hover:text-paper"
              >
                <span>
                  {open.has(g.id) ? INDEX.showLess : INDEX.showMore(g.apps.length - PREVIEW)}
                </span>
                <span aria-hidden="true">{open.has(g.id) ? '↑' : '↓'}</span>
              </button>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function Row({ app }: { app: AppManifest }) {
  const live = app.status !== 'planned';
  const body = (
    <>
      <span className="w-9 shrink-0 font-mono text-xs text-mute">{app.number}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 border border-ink"
            style={{ background: app.accent }}
          />
          <span
            className={`text-[18px] leading-tight font-black uppercase ${live ? '' : 'text-mute'}`}
          >
            {app.name}
          </span>
        </span>
        <span className="mt-0.5 block text-sm text-mute">{app.tagline}</span>
      </span>
      <span
        className={`shrink-0 self-center border-2 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
          live ? 'border-ink' : 'border-ink/30 text-mute'
        }`}
      >
        {app.badge ?? (live ? INDEX.live : INDEX.soon)}
      </span>
    </>
  );
  const cls = 'flex items-start gap-3 px-gutter py-3 no-underline';
  if (app.status === 'planned') {
    return (
      <div className={cls}>
        {body}
        <span className="sr-only">Coming soon.</span>
      </div>
    );
  }
  return (
    <Link
      to={app.route}
      className={`${cls} cell text-ink`}
      style={{ '--accent': app.accent, '--accent-text': 'var(--color-ink)' } as CSSProperties}
    >
      {body}
    </Link>
  );
}

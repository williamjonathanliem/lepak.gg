import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SectionLabel } from '../../components/SectionLabel';
import { DEMO } from '../../copy/landing';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { KataBombDemo } from './demos/KataBombDemo';
import { SplitDemo } from './demos/SplitDemo';
import { StudyDemo } from './demos/StudyDemo';

// 002 on the landing page: Play / Study / Hang out, each with a small looping demo of a real
// app. It moves on to the next tab by itself until someone picks one (and never with
// reduced motion). The demos are scripted and never touch the network.

type TabId = (typeof DEMO.tabs)[number]['id'];
const DEMOS: Record<TabId, () => React.ReactNode> = {
  play: () => <KataBombDemo />,
  study: () => <StudyDemo />,
  hangout: () => <SplitDemo />,
};
const AUTO_MS = 10_000;

export function LiveDemo() {
  const reduced = useReducedMotion();
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState(false);
  const [hovering, setHovering] = useState(false);
  const t = DEMO.tabs[tab]!;

  useEffect(() => {
    if (reduced || picked || hovering) return;
    const timer = setTimeout(() => setTab((i) => (i + 1) % DEMO.tabs.length), AUTO_MS);
    return () => clearTimeout(timer);
  }, [reduced, picked, hovering, tab]);

  return (
    <section
      aria-labelledby="demo-heading"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] border-b-3 border-ink"
    >
      <div className="flex flex-col justify-center gap-6 px-gutter py-[clamp(48px,6vw,88px)]">
        <SectionLabel number="002" title={DEMO.label} />
        <div role="tablist" aria-label="What you can do" className="flex w-fit border-3 border-ink">
          {DEMO.tabs.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              id={`demo-tab-${d.id}`}
              aria-selected={i === tab}
              aria-controls="demo-panel"
              onClick={() => {
                setTab(i);
                setPicked(true);
              }}
              className={`relative min-h-11 cursor-pointer overflow-hidden border-0 px-4 font-mono text-sm font-bold uppercase not-last:border-r-3 not-last:border-ink ${i === tab ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
            >
              {d.tab}
              {/* how long until it moves on by itself */}
              {i === tab && !picked && !reduced && !hovering && (
                <span
                  key={tab}
                  aria-hidden="true"
                  className="demo-timer absolute bottom-0 left-0 h-1 bg-[#ffd23f]"
                  style={{ animationDuration: `${AUTO_MS}ms` }}
                />
              )}
            </button>
          ))}
        </div>
        <div
          id="demo-panel"
          role="tabpanel"
          aria-labelledby={`demo-tab-${t.id}`}
          className="flex flex-col gap-6"
        >
          <h2 id="demo-heading" className="heading-lg m-0">
            {t.heading[0]}
            <br />
            {t.heading[1]}
          </h2>
          <p className="m-0 max-w-[460px] text-[19px]">{t.body}</p>
          <div className="flex flex-wrap gap-3">
            {t.links.map((g) => (
              <Link
                key={g.to}
                to={g.to}
                className="push inline-flex min-h-12 items-center border-3 border-ink px-5 font-mono font-bold text-ink uppercase no-underline shadow-hard"
                style={{ background: g.color }}
              >
                {g.label} →
              </Link>
            ))}
          </div>
          <p className="m-0 font-mono text-xs text-mute">{DEMO.footnote}</p>
        </div>
      </div>

      {/* the demo for the current tab */}
      <div
        aria-hidden="true"
        className="relative min-h-[380px] border-ink max-[700px]:border-t-3 max-[680px]:h-[clamp(340px,100vw,460px)] min-[700px]:border-l-3"
      >
        <div key={t.id} className="absolute inset-0 animate-pop">
          {DEMOS[t.id]()}
        </div>
      </div>
    </section>
  );
}

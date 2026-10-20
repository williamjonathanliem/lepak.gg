import { APPS } from '../../apps/registry';
import { AppGrid } from '../../components/AppGrid';
import { Doodle, HandNote } from '../../components/Doodle';
import { SectionLabel } from '../../components/SectionLabel';
import { INDEX } from '../../copy/landing';

export function IndexSection() {
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
        <p className="m-0 max-w-[360px] font-mono text-sm">
          <SectionLabel number="003" title={INDEX.label} className="block" />
          {INDEX.blurb}
        </p>
      </div>

      <AppGrid
        idPrefix="index"
        apps={APPS}
        // Live apps open directly; KataBomb asks for a nickname itself when needed.
        hrefFor={(app) => (app.status === 'planned' ? undefined : app.route)}
        doodleFor={(app) =>
          app.id === 'katabomb' ? <Doodle name="bomb" className="size-16 animate-wiggle" /> : null
        }
      />
    </section>
  );
}

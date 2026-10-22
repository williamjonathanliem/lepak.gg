import { Link } from 'react-router';
import { SectionLabel } from '../../components/SectionLabel';
import { Sticker } from '../../components/Sticker';
import { CLASS } from '../../copy/landing';

// 005 on the landing page: what lecturers and teachers can run with a class. Every one of
// these works with a projector and students' phones, joined by a 4-letter code.

export function ForClass() {
  return (
    <section id="class" aria-labelledby="class-heading" className="border-b-3 border-ink">
      <div className="relative flex flex-wrap items-end justify-between gap-6 px-gutter pt-[clamp(48px,6vw,80px)] pb-8">
        <div className="flex flex-col gap-4">
          <SectionLabel number="005" title={CLASS.label} />
          <h2 id="class-heading" className="heading-lg m-0">
            {CLASS.heading[0]}
            <br />
            {CLASS.heading[1]}
          </h2>
        </div>
        <p className="m-0 max-w-[420px] text-[19px]">{CLASS.body}</p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-6 right-6 max-sm:hidden"
        >
          <Sticker variant="dark" rotate={-5} bob>
            {CLASS.sticker}
          </Sticker>
        </div>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-[3px] border-t-3 border-ink bg-ink p-0">
        {CLASS.apps.map((a, i) => (
          <li key={a.to} className="flex">
            <Link
              to={a.to}
              className="cell flex flex-1 flex-col gap-3 bg-paper px-gutter py-6 text-ink no-underline"
              style={
                { '--accent': a.color, '--accent-text': 'var(--color-ink)' } as React.CSSProperties
              }
            >
              <span className="flex items-center gap-2 font-mono text-xs">
                <span
                  aria-hidden="true"
                  className="size-3 border-2 border-ink"
                  style={{ background: a.color }}
                />
                0{i + 1}
              </span>
              <span className="text-[22px] leading-tight font-black uppercase">{a.title}</span>
              <span className="text-[15px]">{a.blurb}</span>
              <span className="mt-auto font-mono text-sm font-bold uppercase">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

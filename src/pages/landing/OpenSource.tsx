import { ButtonLink } from '../../components/Button';
import { Doodle, HandNote } from '../../components/Doodle';
import { SectionLabel } from '../../components/SectionLabel';
import { SOURCE } from '../../copy/landing';
import { repoHref } from '../../lib/repo';
import { SITE } from '../../lib/site';

export function OpenSource() {
  const href = repoHref();
  const external = href.startsWith('http');
  return (
    <section
      id="open"
      aria-labelledby="open-heading"
      className="on-dark flex flex-wrap items-end justify-between gap-12 border-b-3 border-ink bg-ink px-gutter py-[clamp(56px,7vw,104px)] text-paper"
    >
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-[22px]">
        <SectionLabel number="005" title={SOURCE.label} className="text-mute-dark" />
        <h2 id="open-heading" className="heading-lg m-0">
          {SOURCE.heading[0]}
          <br />
          {SOURCE.heading[1]}
        </h2>
        <p className="m-0 max-w-[520px] text-[19px] text-[#DADADA]">{SOURCE.body}</p>
      </div>
      <div className="flex min-w-0 flex-[0_1_420px] flex-col gap-4">
        <div className="flex items-end justify-end gap-2 pr-2">
          <HandNote rotate={-6} className="mb-2">
            {SOURCE.note}
          </HandNote>
          <Doodle name="kopi" delay={0.3} className="h-16 w-14" />
        </div>
        <pre
          tabIndex={0}
          aria-label="Terminal commands to fork the project"
          className="m-0 border-3 border-paper p-5 font-mono text-[15px] leading-[1.7] break-all whitespace-pre-wrap"
        >
          {`$ git clone ${SITE.repoUrl}\n$ cd lepak.gg/src/apps\n$ mkdir your-idea`}
        </pre>
        <ButtonLink
          variant="light"
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          className="self-start px-6 py-4"
        >
          {SOURCE.github}
        </ButtonLink>
      </div>
    </section>
  );
}

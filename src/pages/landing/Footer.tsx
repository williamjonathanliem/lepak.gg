import { Doodle, HandNote } from '../../components/Doodle';
import { FOOTER } from '../../copy/landing';
import { Link } from 'react-router';
import { repoHref } from '../../lib/repo';

const LINK = 'inline-flex min-h-11 min-w-11 items-center';

export function Footer() {
  return (
    <footer className="flex flex-col gap-6 px-gutter pt-10 pb-6">
      <div className="flex flex-wrap justify-between gap-4 font-mono text-sm">
        <span>{FOOTER.tagline}</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
          <a className={LINK} href={repoHref()}>
            {FOOTER.links.github}
          </a>
          <a className={LINK} href={repoHref('/issues')}>
            {FOOTER.links.bug}
          </a>
          <a className={LINK} href={repoHref('/blob/main/CONTRIBUTING.md')}>
            {FOOTER.links.contribute}
          </a>
          <Link className={LINK} to="/privacy">
            {FOOTER.links.privacy}
          </Link>
          <Link className={LINK} to="/terms">
            {FOOTER.links.terms}
          </Link>
          <a className={LINK} href="#top">
            {FOOTER.links.top}
          </a>
        </nav>
      </div>
      <div className="relative">
        <div
          aria-hidden="true"
          className="overflow-hidden text-[clamp(80px,21vw,340px)] leading-[0.78] font-black tracking-[-0.07em] whitespace-nowrap uppercase"
        >
          {FOOTER.bigWord}
        </div>
        <div className="pointer-events-none absolute right-[2%] bottom-[10%] flex flex-col items-center gap-1 max-lg:hidden">
          <HandNote rotate={6}>{FOOTER.note}</HandNote>
          <Doodle name="smiley" delay={0.3} className="size-20 animate-wiggle" />
        </div>
      </div>
    </footer>
  );
}

import { useState } from 'react';
import { AppMenu } from '../../components/AppHeader';
import { NAV } from '../../copy/landing';
import { SITE } from '../../lib/site';
import { focusNickname } from './nickname';

const NAV_LINK =
  'flex min-h-11 items-center border-l-3 border-ink px-5 py-3.5 whitespace-nowrap no-underline max-sm:grow max-sm:justify-center max-sm:px-2 max-sm:text-[13px]';

export function TopBar() {
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-stretch justify-between border-b-3 border-ink bg-paper">
      <a
        href="#top"
        className="flex items-center gap-2.5 border-r-3 border-ink px-gutter py-4 font-mono text-xl font-bold tracking-[0.02em] no-underline max-sm:w-full max-sm:py-2.5 max-sm:border-r-0 max-sm:border-b-3"
      >
        <span aria-hidden="true" className="inline-block size-[18px] bg-ink" />
        {SITE.wordmark}
      </a>
      <nav
        aria-label="Main"
        className="flex flex-wrap items-stretch font-mono text-sm uppercase max-sm:w-full"
      >
        <a href="#index" className={`${NAV_LINK} max-sm:border-l-0`}>
          {NAV.index}
        </a>
        <a href="#wall" className={NAV_LINK}>
          {NAV.wall}
        </a>
        <a href="#open" className={NAV_LINK}>
          {NAV.source}
        </a>
        <a
          href="#nickname"
          onClick={(e) => {
            e.preventDefault();
            focusNickname();
          }}
          className={`${NAV_LINK} bg-ink px-6 font-bold text-paper max-sm:px-2`}
        >
          {NAV.enter}
        </a>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
          className={`${NAV_LINK} cursor-pointer bg-paper font-mono font-bold uppercase`}
        >
          Menu
        </button>
      </nav>
      <AppMenu open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}

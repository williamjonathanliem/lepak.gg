import { useState } from 'react';
import { AppMenu } from '../../components/AppHeader';
import { NAV } from '../../copy/landing';
import { SITE } from '../../lib/site';
import { focusNickname } from './nickname';

// Phones get two rows: wordmark + Enter + Menu on top, the four section links as equal
// cells underneath. Wider screens keep everything on one row.
const CELL =
  'flex min-h-11 items-center justify-center border-l-3 border-ink whitespace-nowrap no-underline';
const NAV_LINK = `${CELL} px-5 py-3.5 max-sm:px-1 max-sm:py-2 max-sm:text-xs max-sm:first:border-l-0`;
const ACTION = `${CELL} px-6 py-3.5 font-bold max-sm:px-3 max-sm:text-[13px]`;

export function TopBar() {
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-stretch border-b-3 border-ink bg-paper">
      <a
        href="#top"
        className="flex items-center gap-2.5 border-r-3 border-ink px-gutter py-4 font-mono text-xl font-bold tracking-[0.02em] no-underline max-sm:grow max-sm:border-r-0 max-sm:py-2.5 max-sm:text-lg"
      >
        <span aria-hidden="true" className="inline-block size-[18px] bg-ink max-sm:size-4" />
        {SITE.wordmark}
      </a>
      <nav
        aria-label="Main"
        className="ml-auto flex items-stretch font-mono text-sm uppercase max-sm:order-last max-sm:grid max-sm:w-full max-sm:grid-cols-4 max-sm:border-t-3 max-sm:border-ink"
      >
        <a href="#index" className={NAV_LINK}>
          {NAV.index}
        </a>
        <a href="#wall" className={NAV_LINK}>
          {NAV.wall}
        </a>
        <a href="#class" className={NAV_LINK}>
          {NAV.class}
        </a>
        <a href="#open" className={NAV_LINK}>
          {NAV.source}
        </a>
      </nav>
      <div className="flex items-stretch font-mono text-sm uppercase">
        <a
          href="#nickname"
          onClick={(e) => {
            e.preventDefault();
            focusNickname();
          }}
          className={`${ACTION} bg-ink text-paper`}
        >
          {NAV.enter}
        </a>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
          className={`${ACTION} cursor-pointer bg-paper font-mono uppercase`}
        >
          Menu
        </button>
      </div>
      <AppMenu open={menu} onClose={() => setMenu(false)} />
    </header>
  );
}

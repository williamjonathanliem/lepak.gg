import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SITE } from '../../../lib/site';

/** Slim header shared by the Pages screens. */
export function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-stretch justify-between border-b-3 border-ink">
        <Link
          to="/hub"
          className="flex items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-ink" />
          {SITE.wordmark}
        </Link>
        <div className="flex items-stretch">
          <Link
            to="/pages"
            className="flex min-h-11 items-center gap-2 px-4 font-mono text-sm font-bold uppercase no-underline"
          >
            <span aria-hidden="true" className="inline-block size-2 bg-[#ffd23f] ring-2 ring-ink" />
            Pages
          </Link>
          {right}
        </div>
      </header>
      {children}
    </div>
  );
}

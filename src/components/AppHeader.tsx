import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ROUTED_APPS } from '../apps/registry';
import { CATEGORY_LABEL, type AppCategory } from '../apps/types';
import { AiTag } from './AiTag';
import { rememberApp } from '../lib/activity';
import { SITE } from '../lib/site';

// The bar at the top of every page inside the hub. It stays put while you scroll, says
// which app you're in, and has a Menu that lists every app so you can jump around.

interface AppHeaderProps {
  /** The app you're in, shown next to the wordmark. Leave out on the hub itself. */
  app?: { name: string; to: string; accent?: string };
  /** Dark version for game screens. */
  dark?: boolean;
  /** Extra buttons on the right, before Menu (e.g. sound on/off). */
  children?: ReactNode;
}

export function AppHeader({ app, dark, children }: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const tone = dark
    ? 'on-dark border-b border-paper/15 bg-night text-paper'
    : 'border-b-3 border-ink bg-paper text-ink';
  const divider = dark ? 'border-paper/15' : 'border-ink';
  // The wordmark goes up one level: from an app (or Privacy etc.) to the hub, from the hub
  // to the landing page.
  const onHub = useLocation().pathname === '/hub';
  // Remember the app for the hub's "Jump back in" row.
  const appRoute = app?.to;
  useEffect(() => {
    if (appRoute) rememberApp(appRoute);
  }, [appRoute]);
  const home = onHub ? '/' : '/hub';

  return (
    <header
      className={`sticky top-0 z-40 flex h-12 shrink-0 items-stretch justify-between print:hidden ${tone}`}
    >
      <div className="flex min-w-0 items-stretch">
        <Link
          to={home}
          className="flex shrink-0 items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
          aria-label={onHub ? `${SITE.wordmark} home page` : `${SITE.wordmark} hub`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-3.5 ${dark ? 'bg-paper' : 'bg-ink'}`}
          />
          <span className={app ? 'max-sm:hidden' : ''}>{SITE.wordmark}</span>
        </Link>
        {app && (
          <Link
            to={app.to}
            className={`flex min-w-0 items-center gap-2 border-l ${divider} px-4 font-mono text-sm font-bold uppercase no-underline`}
          >
            <span
              aria-hidden="true"
              className="inline-block size-2.5 shrink-0 border border-current"
              style={{ background: app.accent }}
            />
            <span className="truncate">{app.name}</span>
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-stretch">
        {children}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={`flex min-h-11 min-w-11 cursor-pointer items-center gap-2 border-0 border-l ${divider} bg-transparent px-4 font-mono text-sm font-bold uppercase ${dark ? 'text-paper' : 'text-ink'}`}
        >
          <MenuIcon />
          <span className="max-sm:sr-only">Menu</span>
        </button>
      </div>
      <AppMenu open={open} onClose={() => setOpen(false)} />
    </header>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 16" aria-hidden="true" className="h-4 w-5">
      <path d="M0 2h20M0 8h20M0 14h20" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

const ORDER: AppCategory[] = ['games', 'social', 'study', 'tools', 'group-work'];

/** Slide-in list of every app, grouped. Native <dialog>: focus stays inside, Esc closes. */
export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = ROUTED_APPS.filter(
    (a) => !q || a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q),
  );
  const groups = ORDER.map((c) => ({ c, apps: matches.filter((a) => a.category === c) })).filter(
    (g) => g.apps.length,
  );

  return (
    <dialog
      ref={ref}
      className="menu"
      aria-label="All apps"
      onClose={onClose}
      onClick={(e) => {
        // A click on the dark backdrop (the dialog itself, not its contents) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-stretch justify-between border-b-3 border-ink">
          <span className="flex items-center px-gutter font-mono text-sm font-bold uppercase">
            All apps
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 cursor-pointer border-0 border-l-3 border-ink bg-transparent px-4 font-mono text-sm font-bold uppercase"
          >
            Close ✕
          </button>
        </div>
        <div className="border-b-3 border-ink p-3">
          <label htmlFor="menu-search" className="sr-only">
            Find an app
          </label>
          <input
            id="menu-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an app..."
            autoComplete="off"
            className="h-11 w-full border-3 border-ink bg-paper px-3 font-mono text-sm"
          />
        </div>
        <nav aria-label="Apps" className="min-h-0 flex-1 overflow-y-auto">
          <Link
            to="/hub"
            onClick={onClose}
            aria-current={pathname === '/hub' ? 'page' : undefined}
            className="flex min-h-12 items-center border-b-3 border-ink px-gutter font-black uppercase no-underline hover:bg-ink hover:text-paper"
          >
            ← Hub
          </Link>
          {groups.map(({ c, apps }) => (
            <section key={c} aria-label={CATEGORY_LABEL[c]}>
              <h2 className="m-0 bg-ink px-gutter py-1.5 font-mono text-xs font-bold text-paper uppercase">
                {CATEGORY_LABEL[c]}
              </h2>
              <ul className="m-0 list-none p-0">
                {apps.map((a) => {
                  const here = pathname === a.route || pathname.startsWith(`${a.route}/`);
                  return (
                    <li key={a.id} className="border-b border-ink/20">
                      <Link
                        to={a.route}
                        onClick={onClose}
                        aria-current={here ? 'page' : undefined}
                        className={`flex items-center gap-3 px-gutter py-2.5 no-underline hover:bg-ink hover:text-paper ${here ? 'bg-ink/10' : ''}`}
                      >
                        <span
                          aria-hidden="true"
                          className="size-4 shrink-0 border-2 border-ink"
                          style={{ background: a.accent }}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-bold">
                            {a.name}
                            {a.ai && <AiTag />}
                          </span>
                          <span className="block truncate text-xs opacity-70">{a.tagline}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {groups.length === 0 && (
            <p className="m-0 px-gutter py-6 font-mono text-sm">Nothing called that yet.</p>
          )}
        </nav>
        <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t-3 border-ink px-gutter py-3 font-mono text-xs">
          <Link to="/privacy" onClick={onClose}>
            Privacy
          </Link>
          <Link to="/terms" onClick={onClose}>
            Terms
          </Link>
          <a href={`mailto:${SITE.contact}`}>Report a problem</a>
          <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </div>
    </dialog>
  );
}

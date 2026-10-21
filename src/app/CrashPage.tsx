import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';
import { reportError } from '../lib/monitoring';

/** Shown when a page throws while drawing. Reports the crash and offers a way out. */
export function CrashPage() {
  const error = useRouteError();
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 px-gutter">
      <title>Something broke · Lepak.gg</title>
      <h1 className="heading-lg m-0">Oops.</h1>
      <p className="m-0 max-w-md text-lg">
        Something broke on this page. We've been told about it. Try again, or head back to the hub.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="push h-12 cursor-pointer border-3 border-ink bg-ink px-5 font-mono font-bold text-paper uppercase shadow-hard"
        >
          Try again
        </button>
        <Link
          to="/hub"
          className="flex h-12 items-center border-3 border-ink px-5 font-mono font-bold uppercase no-underline"
        >
          Back to the hub
        </Link>
      </div>
    </main>
  );
}

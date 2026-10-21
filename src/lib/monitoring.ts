// Crash reports (Sentry). When something breaks for a user, the error and where it
// happened are emailed to us, so we can fix it without them having to tell us.
//
// Privacy: no nickname, no IP stored, no screen recording, no performance tracing. Page
// addresses are sent without anything after # or ?, because Lepak Pages edit keys live in
// the # part. Off entirely unless VITE_SENTRY_DSN is set (forks and local dev stay quiet).
// Loaded after the page is up, so it never slows the first paint.

const dsn = import.meta.env.VITE_SENTRY_DSN;

type SentryModule = typeof import('@sentry/react');
let sentry: SentryModule | null = null;
const waiting: unknown[] = [];

/** Strip ?query and #hash from any address. */
export function cleanUrl(url: string): string {
  return url.replace(/[?#].*$/, '');
}

export function startMonitoring() {
  if (!dsn || typeof window === 'undefined') return;
  const start = () =>
    void import('@sentry/react').then((S) => {
      S.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0,
        // Errors from browser extensions aren't ours.
        denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
        beforeSend(event) {
          if (event.request?.url) event.request.url = cleanUrl(event.request.url);
          if (event.request) {
            delete event.request.query_string;
            delete event.request.cookies;
          }
          delete event.user;
          return event;
        },
        beforeBreadcrumb(crumb) {
          // Navigation and fetch crumbs carry addresses: clean them too.
          const data = crumb.data as Record<string, unknown> | undefined;
          if (data) {
            for (const key of ['from', 'to', 'url']) {
              if (typeof data[key] === 'string') data[key] = cleanUrl(data[key]);
            }
          }
          // Console logs can include anything; skip them.
          return crumb.category === 'console' ? null : crumb;
        },
      });
      sentry = S;
      for (const e of waiting.splice(0)) S.captureException(e);
    });
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', () => setTimeout(start, 0), { once: true });
}

/** Report an error we caught ourselves (e.g. a page that crashed while drawing). */
export function reportError(error: unknown) {
  if (!dsn) return;
  if (sentry) sentry.captureException(error);
  else if (waiting.length < 10) waiting.push(error);
}

/** Shown for a moment while an app's code loads on the very first visit. */
export function RouteLoading() {
  return (
    <p role="status" className="px-gutter py-16 font-mono text-sm">
      Loading...
    </p>
  );
}

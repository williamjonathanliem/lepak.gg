// Shared class names and helpers for Toolbox screens.

export const ACCENT = '#7ee081';
export const INPUT = 'h-12 w-full min-w-0 border-3 border-ink bg-paper px-3 font-mono';
export const TEXTAREA =
  'w-full min-w-0 border-3 border-ink bg-paper p-3 font-mono text-sm leading-relaxed';
export const BUTTON =
  'push inline-flex min-h-12 cursor-pointer items-center justify-center border-3 border-ink bg-[#7ee081] px-5 font-mono font-bold uppercase shadow-hard disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none';
export const PLAIN_BUTTON =
  'inline-flex min-h-11 cursor-pointer items-center justify-center border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase';

/** Triggers a download of a Blob with a file name. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

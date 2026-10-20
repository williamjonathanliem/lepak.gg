const NBSP = String.fromCharCode(0xa0); // keeps the gap before the loop repeats

interface MarqueeProps {
  items: readonly string[];
}

/** Black strip of scrolling words. Decorative; stops for reduced motion and on hover. */
export function Marquee({ items }: MarqueeProps) {
  const line = `${items.join(' / ')} /${NBSP}`;
  return (
    <div
      aria-hidden="true"
      className="group overflow-hidden border-b-3 border-ink bg-ink py-4 font-sans text-[clamp(22px,3vw,34px)] font-black tracking-[-0.01em] whitespace-nowrap text-paper uppercase"
    >
      <div className="inline-flex animate-marquee group-hover:[animation-play-state:paused]">
        <span className="pr-8">{line}</span>
        <span className="pr-8">{line}</span>
      </div>
    </div>
  );
}

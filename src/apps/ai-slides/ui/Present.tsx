import { useEffect, useRef, useState } from 'react';
import type { Deck, Theme } from '../logic/deck';
import { useNow } from '../../katabomb/ui/useNow';
import { SlideView } from './SlideView';

const clock = () => Date.now();

function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Present mode: full screen, one slide at a time.
// Keys: → / Space / PageDown next, ← / PageUp back, N speaker notes, Esc leave.
// Touch or click: right half next, left half back.

interface Props {
  deck: Deck;
  theme: Theme;
  start: number;
  onClose: () => void;
}

export function Present({ deck, theme, start, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);
  const [notes, setNotes] = useState(false);
  const total = deck.slides.length;
  const slide = deck.slides[i]!;
  // How long you've been presenting, shown small in the corner.
  const [startedAt] = useState(clock);
  const now = useNow(clock, true, 1000);

  useEffect(() => {
    const el = box.current;
    void el?.requestFullscreen?.().catch(() => undefined);
    // Leaving full screen with the browser's own Esc also leaves present mode.
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault();
        setI((n) => Math.min(total - 1, n + 1));
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        setI((n) => Math.max(0, n - 1));
      } else if (e.key === 'n' || e.key === 'N') setNotes((v) => !v);
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`Presenting ${deck.title}`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
    >
      <div
        className="relative w-[min(100vw,calc((100dvh-var(--notes-h))*16/9))] cursor-pointer"
        style={{ ['--notes-h' as string]: notes ? '28dvh' : '0px' }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setI((n) =>
            e.clientX - r.left > r.width / 2 ? Math.min(total - 1, n + 1) : Math.max(0, n - 1),
          );
        }}
      >
        <SlideView
          key={i}
          slide={slide}
          theme={theme}
          index={i}
          total={total}
          className="animate-pop"
        />
      </div>
      {notes && (
        <div className="h-[28dvh] w-full max-w-5xl overflow-y-auto px-6 py-4 text-lg text-paper">
          <p className="m-0 mb-1 font-mono text-xs text-paper/60 uppercase">Speaker notes</p>
          <p className="m-0">{slide.notes || 'No notes for this slide.'}</p>
        </div>
      )}
      {/* progress along the bottom */}
      <div aria-hidden="true" className="absolute right-0 bottom-0 left-0 h-1.5 bg-paper/10">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${((i + 1) / total) * 100}%`, background: theme.accent }}
        />
      </div>
      <p
        className="absolute top-3 left-3 m-0 font-mono text-sm text-paper/50"
        aria-label="Time presenting"
      >
        {elapsed(now - startedAt)} · {i + 1}/{total}
      </p>
      <div className="absolute top-3 right-3 flex gap-2 opacity-40 transition-opacity hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setNotes((v) => !v)}
          className="min-h-11 cursor-pointer border-2 border-paper bg-black px-3 font-mono text-sm text-paper"
        >
          Notes (N)
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 cursor-pointer border-2 border-paper bg-black px-3 font-mono text-sm text-paper"
        >
          Exit (Esc)
        </button>
      </div>
    </div>
  );
}

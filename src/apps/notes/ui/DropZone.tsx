import { useEffect, useRef, useState, type DragEvent } from 'react';
import { LP } from '../copy';
import { MAX_FILE_BYTES, classifyFile, type DropKind } from '../logic/pages';

// Drop box with visible checks. When a file lands we show, one line at a time, the checks
// we actually do (type, size) and how the file will be protected. No pretend virus scans.

type Phase = 'idle' | 'over' | 'checking' | 'ok' | 'bad';

interface Check {
  label: string;
  ok: boolean;
}

const KIND_LABEL: Record<DropKind, string> = {
  markdown: 'Text / markdown',
  docx: 'Word document',
  pdf: 'PDF',
  html: 'HTML page',
  zip: 'Website (.zip)',
  unsupported: 'Not supported',
};

const PROTECTION: Record<DropKind, string> = {
  markdown: 'Cleaned before showing: no scripts or tricks',
  docx: 'Shown with scripts switched off',
  pdf: 'Opened in the browser’s own PDF viewer',
  html: 'Runs in a sealed frame, away from Lepak data',
  zip: 'Runs in a sealed frame, away from Lepak data',
  unsupported: 'Not uploaded',
};

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

function checksFor(file: File): Check[] {
  const kind = classifyFile(file.name);
  const sizeOk = kind === 'zip' || file.size <= MAX_FILE_BYTES;
  return [
    { label: `Type: ${KIND_LABEL[kind]}`, ok: kind !== 'unsupported' },
    { label: `Size: ${mb(file.size)} of ${mb(MAX_FILE_BYTES)} max`, ok: sizeOk },
    { label: PROTECTION[kind], ok: kind !== 'unsupported' },
    { label: 'Unlisted: only people with the link can open it', ok: true },
  ];
}

const STAGGER_MS = 160;

interface DropZoneProps {
  /** Handles the file; resolves to an error message, or null if it's accepted. */
  onFile: (f: File) => Promise<string | null>;
  /** What's currently picked, e.g. "notes.pdf (1.2 MB)". */
  picked: string | null;
  /** Extra line under the box (e.g. "make editable" for Word files). */
  extra?: React.ReactNode;
  /** A file handed over from elsewhere (the landing page), checked once on arrival. */
  initialFile?: File;
}

export function DropZone({ onFile, picked, extra, initialFile }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  async function take(file: File) {
    const list = checksFor(file);
    setChecks(list);
    setError(null);
    setPhase('checking');
    setRunId((n) => n + 1);
    // Let the checklist tick in before showing the result.
    const [result] = await Promise.all([
      onFile(file),
      new Promise((r) => setTimeout(r, list.length * STAGGER_MS + 200)),
    ]);
    setError(result);
    setPhase(result ? 'bad' : 'ok');
  }

  const handedOver = useRef(false);
  useEffect(() => {
    if (!initialFile || handedOver.current) return;
    // Next tick, so the checklist animates in like a normal drop. The flag is set inside the
    // timer because React runs effects twice in development and cancels the first timer.
    const t = setTimeout(() => {
      handedOver.current = true;
      void take(initialFile);
    }, 0);
    return () => clearTimeout(t);
    // take is stable enough for a one-off; we only want this on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) void take(f);
    else setPhase('idle');
  }

  const over = phase === 'over';
  const tone =
    phase === 'bad'
      ? 'bg-[#ffe1d9]'
      : phase === 'ok'
        ? 'bg-[#e6f8e7]'
        : over
          ? 'bg-[#ffd23f]'
          : 'bg-paper';

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setPhase('over');
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          // only when leaving the box itself, not its children
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setPhase((p) => (p === 'over' ? 'idle' : p));
          }
        }}
        onDrop={onDrop}
        className={`relative flex flex-col items-center gap-3 px-6 py-10 text-center transition-[background-color,scale] duration-200 ${tone} ${over ? 'scale-[1.02]' : ''} ${phase === 'bad' ? 'animate-shake' : ''}`}
        style={{
          // Dashed border drawn with gradients so it can "march" while you drag over it.
          backgroundImage:
            'linear-gradient(90deg, var(--color-ink) 50%, transparent 50%), linear-gradient(90deg, var(--color-ink) 50%, transparent 50%), linear-gradient(0deg, var(--color-ink) 50%, transparent 50%), linear-gradient(0deg, var(--color-ink) 50%, transparent 50%)',
          backgroundRepeat: 'repeat-x, repeat-x, repeat-y, repeat-y',
          backgroundSize: '16px 3px, 16px 3px, 3px 16px, 3px 16px',
          backgroundPosition: '0 0, 0 100%, 0 0, 100% 0',
          animation: over ? 'var(--animate-ants)' : undefined,
        }}
      >
        <span
          aria-hidden="true"
          className={`flex size-16 items-center justify-center border-3 border-ink bg-paper shadow-hard-sm ${over ? 'animate-bounce-y' : ''}`}
        >
          {phase === 'ok' ? (
            <span className="animate-pop text-3xl font-black">✓</span>
          ) : phase === 'bad' ? (
            <span className="animate-pop text-3xl font-black text-hot">✕</span>
          ) : (
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            >
              <path d="M6 2h9l5 5v15H6zM14 2v6h6M13 18v-7M10 14l3-3 3 3" />
            </svg>
          )}
        </span>

        <p className="m-0 text-xl font-black uppercase" aria-live="polite">
          {over ? LP.dropNow : phase === 'checking' ? LP.checking : (picked ?? LP.dropTitle)}
        </p>

        {phase !== 'idle' && phase !== 'over' && (
          <ul
            key={runId}
            className="m-0 flex list-none flex-col gap-1 p-0 text-left font-mono text-sm"
          >
            {checks.map((c, i) => (
              <li
                key={c.label}
                className="flex animate-check-in items-center gap-2"
                style={{ animationDelay: `${i * STAGGER_MS}ms` }}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex size-5 shrink-0 items-center justify-center border-2 border-ink text-xs font-black ${c.ok ? 'bg-[#7ee081]' : 'bg-hot'}`}
                >
                  {c.ok ? '✓' : '✕'}
                </span>
                <span className="sr-only">{c.ok ? 'Passed: ' : 'Failed: '}</span>
                {c.label}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="m-0 font-mono text-sm font-bold">
            ! {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
        >
          {picked ? LP.pickAnother : LP.orBrowse}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.markdown,.txt,.docx,.pdf,.html,.htm,.zip"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void take(f);
            e.target.value = '';
          }}
        />
      </div>
      {extra}
      <p className="m-0 font-mono text-xs text-mute">{LP.dropHint}</p>
    </div>
  );
}

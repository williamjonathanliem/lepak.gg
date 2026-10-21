import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router';
import { SectionLabel } from '../../components/SectionLabel';
import { Sticker } from '../../components/Sticker';
import { STUDY } from '../../copy/landing';

// 004 on the landing page: one drop box for your notes, then pick what to make with them:
// a shareable page, study notes + flashcards, or slides. The file is handed to that app in
// memory (nothing is uploaded until you say so there).

const OPTIONS = [
  { to: '/ai-notes', accent: '#ffd23f', ...STUDY.options.notes },
  { to: '/ai-slides', accent: '#b9a2ff', ...STUDY.options.slides },
  { to: '/pages', accent: '#7ee081', ...STUDY.options.page },
] as const;

export function StudyKit() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  return (
    <section
      id="pages"
      aria-labelledby="study-heading"
      className="flex flex-wrap border-b-3 border-ink"
    >
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6 px-gutter py-[clamp(48px,6vw,88px)]">
        <div className="flex flex-wrap items-center gap-3">
          <SectionLabel number="004" title={STUDY.label} />
          <span className="border-2 border-ink bg-[#ffd23f] px-2 py-0.5 font-mono text-[13px] font-bold uppercase">
            {STUDY.badge}
          </span>
        </div>
        <h2 id="study-heading" className="heading-lg m-0">
          {STUDY.heading[0]}
          <br />
          {STUDY.heading[1]}
        </h2>
        <p className="m-0 max-w-[480px] text-[19px]">{STUDY.body}</p>
        <ul className="m-0 flex max-w-[520px] list-none flex-col border-3 border-ink p-0">
          {OPTIONS.map((o) => (
            <li key={o.to} className="flex gap-4 border-ink px-4 py-3.5 not-last:border-b-3">
              <span
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 border-2 border-ink"
                style={{ background: o.accent }}
              />
              <span>
                <strong className="block font-black uppercase">{o.title}</strong>
                <span className="text-[15px] text-mute">{o.blurb}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-5 border-ink bg-paper bg-[repeating-linear-gradient(0deg,var(--color-paper)_0_31px,var(--color-faint)_31px_32px)] px-[clamp(16px,3vw,48px)] py-[clamp(32px,5vw,72px)] min-[880px]:border-l-3 max-[880px]:border-t-3">
        <div aria-hidden="true" className="pointer-events-none absolute top-4 right-4 z-10">
          <Sticker variant="dark" rotate={-4} bob>
            {STUDY.sticker}
          </Sticker>
        </div>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
          }}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-3.5 border-3 border-dashed border-ink px-6 py-9 text-center transition-[background-color,scale] duration-200 ${over ? 'scale-[1.02] bg-[#ffd23f]' : 'bg-paper'}`}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            aria-hidden="true"
            className={over ? 'animate-bounce-y' : ''}
          >
            <path d="M6 2h9l5 5v15H6zM14 2v6h6M13 18v-7M10 14l3-3 3 3" />
          </svg>
          <div className="text-[22px] font-black tracking-[-0.01em] uppercase" aria-live="polite">
            {over ? STUDY.dropNow : file ? file.name : STUDY.dropTitle}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
          >
            {file ? STUDY.another : STUDY.browse}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.pptx,.docx,.txt,.md"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = '';
            }}
          />
          <div className="font-mono text-[13px] text-mute">{STUDY.dropHint}</div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="m-0 font-mono text-xs uppercase">{file ? STUDY.pick : STUDY.orStart}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map((o) => (
              <button
                key={o.to}
                type="button"
                onClick={() => navigate(o.to, { state: file ? { file } : undefined })}
                className="push min-h-14 cursor-pointer border-3 border-ink px-2 py-2 font-mono text-[13px] font-bold whitespace-nowrap uppercase shadow-hard-sm"
                style={{ background: file ? o.accent : '#f9fafb' }}
              >
                {o.button} →
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

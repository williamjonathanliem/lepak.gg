import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SectionLabel } from '../../components/SectionLabel';
import { Sticker } from '../../components/Sticker';
import { PAGES } from '../../copy/landing';

// Lepak Pages on the landing page. Drop a file or type a link here and you land on
// /pages with it already filled in (the file is handed over in memory, not uploaded yet).
export function PagesTeaser() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [slug, setSlug] = useState('');

  const openWithFile = (file: File) => navigate('/pages', { state: { file } });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) openWithFile(f);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate('/pages', { state: { slug: slug.trim() } });
  }

  return (
    <section
      id="pages"
      aria-labelledby="pages-heading"
      className="flex flex-wrap border-b-3 border-ink"
    >
      <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6 px-gutter py-[clamp(48px,6vw,88px)]">
        <div className="flex flex-wrap items-center gap-3">
          <SectionLabel number="004" title={PAGES.label} />
          <span className="border-2 border-ink bg-[#ffd23f] px-2 py-0.5 font-mono text-[13px] font-bold uppercase">
            {PAGES.badge}
          </span>
        </div>
        <h2 id="pages-heading" className="heading-lg m-0">
          {PAGES.heading[0]}
          <br />
          {PAGES.heading[1]}
        </h2>
        <p className="m-0 max-w-[480px] text-[19px]">{PAGES.body}</p>
        <ol className="m-0 flex max-w-[480px] list-none flex-col border-3 border-ink p-0">
          {PAGES.steps.map((step, i) => (
            <li
              key={step}
              className="flex gap-4 border-ink px-4 py-3.5 font-mono text-[15px] not-last:border-b-3"
            >
              <strong>{String(i + 1).padStart(2, '0')}</strong>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="relative flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-6 border-ink bg-paper bg-[repeating-linear-gradient(0deg,var(--color-paper)_0_31px,var(--color-faint)_31px_32px)] px-[clamp(16px,3vw,48px)] py-[clamp(32px,5vw,72px)] min-[880px]:border-l-3 max-[880px]:border-t-3">
        <div aria-hidden="true" className="pointer-events-none absolute top-4 right-4 z-10">
          <Sticker variant="dark" rotate={-4} bob>
            {PAGES.badge}
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
          className={`flex flex-col items-center gap-3.5 border-3 border-dashed border-ink px-6 py-10 text-center transition-[background-color,scale] duration-200 ${over ? 'scale-[1.02] bg-[#ffd23f]' : 'bg-paper'}`}
        >
          <svg
            width="56"
            height="56"
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
          <div className="text-[22px] font-black tracking-[-0.01em] uppercase">
            {over ? PAGES.dropNow : PAGES.dropTitle}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
          >
            {PAGES.browse}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,.txt,.docx,.pdf,.html,.htm,.zip"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) openWithFile(f);
            }}
          />
          <div className="font-mono text-[13px] text-mute">{PAGES.dropHint}</div>
        </div>

        <form
          onSubmit={onSubmit}
          className="m-0 flex flex-wrap items-stretch border-3 border-ink bg-paper p-0 shadow-hard"
        >
          <label
            htmlFor="slug"
            className="flex items-center border-r-3 border-ink bg-soft px-3 font-mono text-sm"
          >
            {PAGES.slugPrefix}
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            maxLength={40}
            placeholder={PAGES.slugExample}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="h-[54px] min-w-0 flex-[1_1_140px] border-0 bg-paper px-3 font-mono text-base text-ink"
          />
          <button
            type="submit"
            className="min-h-[54px] cursor-pointer border-0 border-l-3 border-ink bg-ink px-5 font-mono text-[15px] font-bold text-paper uppercase"
          >
            {PAGES.publish} →
          </button>
        </form>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { SectionLabel } from '../../components/SectionLabel';
import { Sticker } from '../../components/Sticker';
import { WALL } from '../../copy/landing';
import { getNickname, saveNickname } from '../../lib/identity';
import {
  NOTE_COLORS,
  NOTE_KINDS,
  NOTE_MAX,
  checkNote,
  postNote,
  removeNote,
  setPlus,
  setReport,
  NoteRefused,
  sortNotes,
  wallEnabled,
  watchWall,
  type NoteKind,
  type WallNote,
  type WallSort,
} from '../../lib/wall';

// 004 on the landing page: a wall of sticky notes. Tap (or drag) a sheet off one of the
// coloured pads, write on it right there on the wall, and stick it. Others +1 the ones they
// agree with, so the best float up. Firebase only loads once the wall scrolls near the
// screen, so the top of the page stays fast.

/** Notes shown before "+ N more", so the page stays short. */
const PREVIEW = 9;
/** Rules allow one note a minute; check here too so people get a clear message. */
const POST_GAP_MS = 60_000;
const DRAG_TYPE = 'application/x-lepak-note';

type Load = 'idle' | 'loading' | 'ready' | 'offline';

export function Wall() {
  const sectionRef = useRef<HTMLElement>(null);
  const [load, setLoad] = useState<Load>(wallEnabled ? 'idle' : 'offline');
  const [notes, setNotes] = useState<WallNote[]>([]);
  const [sort, setSort] = useState<WallSort>('top');
  const [all, setAll] = useState(false);
  /** Colour of the sheet being written on, or null when there's no draft. */
  const [draft, setDraft] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const lastPost = useRef(0);
  const tooSoon = () => Date.now() - lastPost.current < POST_GAP_MS;
  const posted = () => {
    lastPost.current = Date.now();
  };

  // Start listening when the wall comes near the screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (load !== 'idle' || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLoad('loading');
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  const listening = load === 'loading' || load === 'ready';
  useEffect(() => {
    if (!listening) return;
    return watchWall(
      (n) => {
        setNotes(n);
        setLoad('ready');
      },
      () => setLoad('offline'),
    );
  }, [listening]);

  function onDrop(e: DragEvent) {
    const color = e.dataTransfer.getData(DRAG_TYPE);
    setDropping(false);
    if (color === '') return;
    e.preventDefault();
    setDraft(Number(color));
  }

  // Notes reported by several people wait for an admin, out of sight.
  const visible = notes.filter((n) => !n.hidden);
  const sorted = sortNotes(visible, sort);
  const shown = all ? sorted : sorted.slice(0, PREVIEW);
  const canPost = load === 'ready';

  return (
    <section
      ref={sectionRef}
      id="wall"
      aria-labelledby="wall-heading"
      className="flex flex-wrap border-b-3 border-ink"
    >
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-6 px-gutter py-[clamp(48px,6vw,88px)]">
        <SectionLabel number="004" title={WALL.label} />
        <h2 id="wall-heading" className="heading-lg m-0">
          {WALL.heading[0]}
          <br />
          {WALL.heading[1]}
        </h2>
        <p className="m-0 max-w-[440px] text-[19px]">{WALL.body}</p>
        <ol className="m-0 flex max-w-[440px] list-none flex-col gap-1.5 p-0 font-mono text-sm">
          {WALL.howTo.map((line, i) => (
            <li key={line} className="flex gap-3">
              <span className="font-bold">{String(i + 1).padStart(2, '0')}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
        }}
        onDrop={onDrop}
        className={`relative min-w-0 flex-[2_1_560px] border-ink bg-[radial-gradient(var(--color-faint)_1.5px,transparent_1.5px)] [background-size:18px_18px] px-[clamp(16px,3vw,48px)] py-[clamp(32px,5vw,64px)] transition-colors min-[960px]:border-l-3 max-[960px]:border-t-3 ${dropping ? 'bg-soft' : 'bg-paper'}`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -top-5 right-6 z-10">
          <Sticker variant="dark" rotate={5} bob>
            {WALL.sticker}
          </Sticker>
        </div>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          {canPost && (
            <div role="group" aria-labelledby="wall-pads" className="flex flex-col gap-2">
              <span id="wall-pads" className="font-mono text-xs font-bold uppercase">
                {WALL.takeOne}
              </span>
              <div className="flex gap-4 pr-2 pb-2">
                {NOTE_COLORS.map((c, i) => (
                  <Pad
                    key={c}
                    color={c}
                    label={WALL.takeLabel(WALL.colorNames[i]!)}
                    active={draft === i}
                    onTake={() => setDraft(i)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, String(i));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div role="group" aria-label={WALL.sortLabel} className="flex w-fit border-3 border-ink">
            {(['top', 'new'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className={`min-h-11 min-w-20 cursor-pointer border-0 px-4 font-mono text-sm font-bold uppercase not-last:border-r-3 not-last:border-ink ${sort === k ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
              >
                {WALL.sort[k]}
              </button>
            ))}
          </div>
        </div>

        {dropping && (
          <p className="pointer-events-none m-0 mb-4 font-mono text-sm font-bold uppercase">
            {WALL.dropHere}
          </p>
        )}

        {(draft !== null || visible.length > 0) && (
          <ul
            id="wall-notes"
            className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-x-5 gap-y-7 p-0 pt-2"
          >
            {draft !== null && (
              <li>
                <Draft
                  color={draft}
                  onColor={setDraft}
                  onClose={() => setDraft(null)}
                  tooSoon={tooSoon}
                  onPosted={posted}
                />
              </li>
            )}
            {shown.map((n) => (
              <li key={n.id}>
                <Note note={n} />
              </li>
            ))}
          </ul>
        )}

        {load === 'offline' ? (
          <p className="m-0 font-mono text-sm">{WALL.offline}</p>
        ) : load !== 'ready' ? (
          <p className="m-0 font-mono text-sm text-mute">{WALL.loading}</p>
        ) : (
          visible.length === 0 &&
          draft === null && (
            <p className="m-0 max-w-[320px] -rotate-1 border-3 border-dashed border-ink bg-paper p-6 text-lg font-bold">
              {WALL.empty}
            </p>
          )
        )}

        {load === 'ready' && visible.length > PREVIEW && (
          <button
            type="button"
            aria-expanded={all}
            aria-controls="wall-notes"
            onClick={() => setAll((v) => !v)}
            className="push mt-8 min-h-12 cursor-pointer border-3 border-ink bg-paper px-5 font-mono text-sm font-bold uppercase shadow-hard-sm"
          >
            {all ? WALL.showLess : WALL.showMore(visible.length - PREVIEW)}
          </button>
        )}
      </div>
    </section>
  );
}

/** A little stack of sticky notes. Tap to tear one off, or drag a sheet onto the wall. */
function Pad({
  color,
  label,
  active,
  onTake,
  onDragStart,
}: {
  color: string;
  label: string;
  active: boolean;
  onTake: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onTake}
      aria-label={label}
      aria-pressed={active}
      className="wall-pad relative isolate size-14 cursor-grab border-0 bg-transparent p-0 active:cursor-grabbing"
      style={{ '--pad': color } as CSSProperties}
    >
      {/* sheets underneath */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 translate-[8px] border-3 border-ink bg-(--pad)"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 translate-[4px] border-3 border-ink bg-(--pad)"
      />
      <span
        aria-hidden="true"
        className="wall-pad-top absolute inset-0 grid place-items-center border-3 border-ink bg-(--pad) text-2xl font-black"
      >
        +
      </span>
    </button>
  );
}

function Draft({
  color,
  onColor,
  onClose,
  tooSoon,
  onPosted,
}: {
  color: number;
  onColor: (c: number) => void;
  onClose: () => void;
  tooSoon: () => boolean;
  onPosted: () => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<NoteKind>('idea');
  const [nick, setNick] = useState(() => getNickname());
  const [nickDraft, setNickDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);

  async function stick() {
    const checked = checkNote(text);
    if (!checked.ok) return setError(WALL.errors[checked.error]);
    let name = nick;
    if (!name) {
      const saved = saveNickname(nickDraft);
      if (!saved.ok) return setError(WALL.errors.nick);
      name = saved.value;
      setNick(name);
    }
    if (tooSoon()) return setError(WALL.errors.slow);
    setBusy(true);
    setError(null);
    try {
      await postNote({ text: checked.text, kind, color, nick: name });
      onPosted();
      setStuck(true);
      // Let the "stuck" moment show, then the real note takes its place in the list.
      setTimeout(onClose, 700);
    } catch (e) {
      setError(WALL.errors[e instanceof NoteRefused ? e.code : 'failed']);
      setBusy(false);
    }
  }

  const left = NOTE_MAX - text.length;

  return (
    <form
      aria-label={WALL.draftLabel}
      onSubmit={(e) => {
        e.preventDefault();
        void stick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className={`wall-peel relative flex min-h-[200px] flex-col gap-2.5 border-3 border-ink p-3.5 pt-5 shadow-hard ${stuck ? 'wall-stuck' : ''}`}
      style={{ background: NOTE_COLORS[color] }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2 border-2 border-ink/40 bg-paper/75"
      />
      <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
        <legend className="sr-only">{WALL.kindLabel}</legend>
        {NOTE_KINDS.map((k) => (
          <label
            key={k}
            className="flex min-h-8 cursor-pointer items-center border-2 border-ink bg-paper px-2 font-mono text-[11px] font-bold uppercase has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
          >
            <input
              type="radio"
              name="wall-kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="sr-only"
            />
            {WALL.kinds[k]}
          </label>
        ))}
      </fieldset>

      <label htmlFor="wall-text" className="sr-only">
        {WALL.textLabel}
      </label>
      <textarea
        id="wall-text"
        // The sheet was just taken on purpose, so writing on it straight away is expected.
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void stick();
          }
        }}
        maxLength={NOTE_MAX + 20}
        rows={4}
        placeholder={WALL.placeholder}
        className="w-full flex-1 resize-none border-0 border-b-2 border-dashed border-ink/40 bg-transparent p-0 text-[17px] leading-snug font-bold placeholder:text-ink/45 focus:outline-none focus-visible:border-ink"
      />

      {!nick && (
        <>
          <label htmlFor="wall-nick" className="sr-only">
            {WALL.nickLabel}
          </label>
          <input
            id="wall-nick"
            value={nickDraft}
            onChange={(e) => setNickDraft(e.target.value)}
            maxLength={16}
            autoComplete="nickname"
            placeholder={WALL.nickPlaceholder}
            className="min-h-10 border-2 border-ink bg-paper px-2 font-mono text-sm"
          />
        </>
      )}

      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span>{nick ? WALL.by(nick) : ''}</span>
        <span className={left < 0 ? 'font-bold' : ''}>{left <= 30 ? WALL.left(left) : ''}</span>
      </div>

      <fieldset className="m-0 flex gap-1.5 border-0 p-0">
        <legend className="sr-only">{WALL.colorLabel}</legend>
        {NOTE_COLORS.map((c, i) => (
          <label
            key={c}
            className="size-6 cursor-pointer border-2 border-ink has-checked:outline-2 has-checked:outline-offset-1 has-checked:outline-ink has-focus-visible:outline-3"
            style={{ background: c }}
          >
            <input
              type="radio"
              name="wall-color"
              checked={color === i}
              onChange={() => onColor(i)}
              className="sr-only"
            />
            <span className="sr-only">{WALL.colorNames[i]}</span>
          </label>
        ))}
      </fieldset>

      <p role="status" className="m-0 min-h-4 font-mono text-xs font-bold">
        {stuck ? WALL.posted : error}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="push min-h-11 flex-1 cursor-pointer border-3 border-ink bg-ink px-3 font-mono text-sm font-bold text-paper uppercase shadow-hard-sm disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? WALL.posting : WALL.post}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 cursor-pointer border-0 bg-transparent px-2 font-mono text-xs font-bold text-ink underline"
        >
          {WALL.cancel}
        </button>
      </div>
    </form>
  );
}

/** A small, steady tilt per note, so the wall looks hand-stuck but doesn't jump around. */
function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.8;
}

function Note({ note }: { note: WallNote }) {
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      // the live list shows the real state; nothing to undo
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="wall-note relative flex min-h-[200px] flex-col gap-3 border-3 border-ink p-4 pt-5 shadow-hard-sm"
      style={{ background: NOTE_COLORS[note.color], rotate: `${tiltOf(note.id)}deg` }}
    >
      {/* a strip of tape holding it up */}
      <span
        aria-hidden="true"
        className="absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-2 border-2 border-ink/40 bg-paper/75"
      />
      <span className="w-fit border-2 border-ink bg-paper px-1.5 font-mono text-[11px] font-bold uppercase">
        {WALL.kinds[note.kind]}
      </span>
      <p className="m-0 flex-1 text-[17px] leading-snug font-bold break-words">{note.text}</p>
      <p className="m-0 truncate font-mono text-xs">{WALL.by(note.nick)}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          aria-pressed={note.plussed}
          aria-label={WALL.plusLabel(note.plus, note.plussed)}
          onClick={() => void run(() => setPlus(note.id, !note.plussed))}
          className={`min-h-11 min-w-16 cursor-pointer border-3 border-ink px-2 font-mono text-sm font-bold ${note.plussed ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
        >
          {note.plus > 0 ? `▲ ${note.plus}` : WALL.plus}
        </button>
        <span className="flex-1" />
        {note.mine ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => removeNote(note.id))}
            className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-mono text-xs font-bold text-ink underline"
          >
            {WALL.remove}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            aria-pressed={note.reported}
            onClick={() => void run(() => setReport(note.id, !note.reported))}
            className="min-h-11 cursor-pointer border-0 bg-transparent px-1 font-mono text-xs font-bold text-ink underline"
          >
            {note.reported ? WALL.reported : WALL.report}
          </button>
        )}
      </div>
    </article>
  );
}

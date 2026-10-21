import { useEffect, useRef, useState } from 'react';
import { firebaseEnabled } from '../../../lib/firebase';
import { shiftPosition, textDiff, type DeltaOp } from '../logic/textDiff';
import { LOCAL_ORIGIN, openCollab, type Collab } from '../net/collab';

interface Props {
  id: string;
  slug: string;
  /** The page's edit key. Without it (or without Firebase), this is a normal textarea. */
  editKey: string | null;
  /** The saved note, loaded in by whoever opens the editor first. */
  seed: string;
  nickname: string;
  maxLength: number;
  className?: string;
  onChange: (text: string) => void;
}

type Mode = 'connecting' | 'live' | 'solo';

/**
 * The note editor. Everyone with the edit link who opens it at the same time types into
 * the same text, live. Your cursor stays put when others type above it.
 */
export function CollabTextarea({
  id,
  slug,
  editKey,
  seed,
  nickname,
  maxLength,
  className,
  onChange,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const collab = useRef<Collab | null>(null);
  const last = useRef(seed);
  const seedRef = useRef(seed);
  const onChangeRef = useRef(onChange);
  const canShare = !!editKey && firebaseEnabled;
  const [mode, setMode] = useState<Mode>(canShare ? 'connecting' : 'solo');
  const [others, setOthers] = useState<string[]>([]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!canShare || !editKey) return;
    let closed = false;
    let opened: Collab | null = null;
    openCollab(slug, editKey, seedRef.current, nickname)
      .then((c) => {
        if (closed) return c.close();
        opened = c;
        collab.current = c;
        const el = ref.current;
        if (!el) return;
        const show = () => {
          const v = c.text.toString();
          el.value = v;
          last.current = v;
          onChangeRef.current(v);
        };
        show();
        c.text.observe((event, tr) => {
          if (tr.origin === LOCAL_ORIGIN) return;
          const focused = document.activeElement === el;
          const delta = event.delta as DeltaOp[];
          const start = shiftPosition(el.selectionStart, delta);
          const end = shiftPosition(el.selectionEnd, delta);
          show();
          if (focused) el.setSelectionRange(start, end);
        });
        c.onPeers(setOthers);
        setMode('live');
      })
      .catch(() => {
        if (!closed) setMode('solo');
      });
    return () => {
      closed = true;
      opened?.close();
      collab.current = null;
    };
  }, [canShare, slug, editKey, nickname]);

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        id={id}
        ref={ref}
        defaultValue={seed}
        readOnly={mode === 'connecting'}
        aria-busy={mode === 'connecting'}
        onInput={(e) => {
          const el = e.currentTarget;
          if (el.value.length > maxLength) {
            el.value = last.current;
            return;
          }
          const change = textDiff(last.current, el.value);
          last.current = el.value;
          onChange(el.value);
          if (change && collab.current) collab.current.apply(change);
        }}
        className={className}
      />
      <p
        className="m-0 flex flex-wrap items-center gap-2 font-mono text-xs text-mute"
        role="status"
      >
        {mode === 'connecting' && 'Connecting so others can edit with you...'}
        {mode === 'live' &&
          (others.length
            ? `Editing live with ${others.join(', ')}. Anyone can press Save.`
            : 'Live: anyone you send the edit link to can type here with you.')}
        {mode === 'solo' && canShare && 'Live editing is off right now. Your changes still save.'}
      </p>
    </div>
  );
}

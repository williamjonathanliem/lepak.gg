import { Excalidraw, useHandleLibrary } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  LibraryItems,
  SocketId,
} from '@excalidraw/excalidraw/types';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { getNickname } from '../../../lib/identity';
import { readStorage, writeStorage } from '../../../lib/storage';
import { avatarColor } from '../../katabomb/ui/avatar';
import { SITE } from '../../../lib/site';
import { changedSince, mergeElements } from '../logic/sync';
import { openBoard, type BoardConnection } from '../net/boardSync';

// The drawing surface. Solo boards save to this browser; shared boards sync live
// through Firebase (see net/boardSync.ts).

const SOLO_KEY = 'lepak.whiteboard.solo';
const LIBRARY_KEY = 'lepak.whiteboard.library';

/**
 * Saves shape libraries (from libraries.excalidraw.com, "Browse libraries") on this device,
 * so they're there next time on any board.
 */
const libraryAdapter = {
  load() {
    try {
      const raw = readStorage(LIBRARY_KEY);
      return raw ? { libraryItems: JSON.parse(raw) as LibraryItems } : null;
    } catch {
      return null;
    }
  },
  save({ libraryItems }: { libraryItems: LibraryItems }) {
    writeStorage(LIBRARY_KEY, JSON.stringify(libraryItems));
  },
};
const SEND_EVERY_MS = 120;

type El = ExcalidrawElement;

function loadSolo(): El[] {
  try {
    return JSON.parse(readStorage(SOLO_KEY) ?? '[]') as El[];
  } catch {
    return [];
  }
}

interface BoardProps {
  /** Room code for a shared board, or null for a solo board on this device. */
  code: string | null;
}

export function Board({ code }: BoardProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [people, setPeople] = useState(1);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const conn = useRef<BoardConnection | null>(null);
  const known = useRef(new Map<string, number>()); // last version sent/received per shape
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initial] = useState(() => (code ? [] : loadSolo()));
  const [nickname] = useState(() => getNickname() ?? 'guest');

  // Adds libraries picked on libraries.excalidraw.com (they come back via the URL) and
  // keeps the library saved on this device.
  useHandleLibrary({ excalidrawAPI: api, adapter: libraryAdapter });

  // Shared board: connect, merge what others draw.
  useEffect(() => {
    if (!code || !api) return;
    let closed = false;
    openBoard<El>(code, {
      onRemote(remote) {
        for (const r of remote) {
          known.current.set(r.id, Math.max(known.current.get(r.id) ?? -1, r.version));
        }
        const merged = mergeElements(api.getSceneElementsIncludingDeleted(), remote);
        api.updateScene({ elements: merged });
      },
      onPeople: setPeople,
      onCursors(cursors) {
        // Everyone else's mouse, drawn by the board as named, coloured pointers.
        const collaborators = new Map<SocketId, Collaborator>();
        for (const [id, c] of Object.entries(cursors)) {
          if (id === conn.current?.selfId) continue;
          const color = avatarColor(id);
          collaborators.set(id as SocketId, {
            id,
            username: c.n,
            pointer: { x: c.x, y: c.y, tool: c.t === 'laser' ? 'laser' : 'pointer' },
            button: c.b === 'down' ? 'down' : 'up',
            color: { background: color, stroke: '#000000' },
          });
        }
        api.updateScene({ collaborators });
      },
    })
      .then((c) => {
        if (closed) c.close();
        else conn.current = c;
      })
      .catch(() => setFailed(true));
    return () => {
      closed = true;
      if (pending.current) clearTimeout(pending.current);
      conn.current?.close();
      conn.current = null;
    };
  }, [code, api]);

  function onChange(elements: readonly El[]) {
    if (!code) {
      // Solo: save to this browser (deleted shapes dropped).
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        writeStorage(SOLO_KEY, JSON.stringify(elements.filter((e) => !e.isDeleted)));
      }, 400);
      return;
    }
    // Shared: send only what changed, a few times a second at most.
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      const all = api?.getSceneElementsIncludingDeleted() ?? elements;
      const changed = changedSince(all, known.current);
      if (!changed.length) return;
      for (const e of changed) known.current.set(e.id, e.version);
      conn.current?.send(changed);
    }, SEND_EVERY_MS);
  }

  const link = code ? `${window.location.origin}/whiteboard/r/${code}` : '';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <title>{code ? `Whiteboard ${code} · Lepak.gg` : 'Whiteboard · Lepak.gg'}</title>
      <header className="flex h-12 shrink-0 items-stretch justify-between border-b-3 border-ink bg-paper">
        <Link
          to="/whiteboard"
          className="flex items-center gap-2 px-gutter font-mono text-sm font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-ink" />
          {SITE.wordmark}
          <span className="max-sm:hidden"> · WHITEBOARD</span>
        </Link>
        {code ? (
          <div className="flex items-stretch font-mono text-sm">
            <span className="flex items-center px-3 text-mute">{people} here</span>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard?.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
              className="min-h-11 cursor-pointer border-0 border-l-3 border-ink bg-[#4fd1e8] px-4 font-mono font-bold tracking-[0.2em] uppercase"
              aria-label={`Copy board link, code ${code}`}
            >
              {copied ? 'Copied!' : code}
            </button>
          </div>
        ) : (
          <span className="flex items-center px-4 font-mono text-xs text-mute">
            Saved on this device
          </span>
        )}
      </header>
      {failed && (
        <p
          role="alert"
          className="m-0 border-b-3 border-ink bg-[#ffd23f] px-gutter py-2 font-mono text-sm"
        >
          Could not connect to the shared board. Your drawing stays on this screen only.
        </p>
      )}
      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={{ elements: initial, appState: { viewBackgroundColor: '#f9fafb' } }}
          onChange={(elements) => onChange(elements)}
          isCollaborating={!!code}
          onPointerUpdate={
            code
              ? ({ pointer, button }) =>
                  conn.current?.sendCursor({
                    x: pointer.x,
                    y: pointer.y,
                    n: nickname,
                    t: pointer.tool,
                    b: button,
                  })
              : undefined
          }
          // Images aren't synced (they'd be big files), so the image tool is hidden.
          UIOptions={{ tools: { image: false }, canvasActions: { loadScene: false } }}
        />
      </div>
    </div>
  );
}

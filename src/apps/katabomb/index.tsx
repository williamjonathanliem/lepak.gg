import { useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import { SITE } from '../../lib/site';
import { KB } from './copy';
import { Home } from './ui/Home';
import { RoomPage } from './ui/RoomPage';
import { isMuted, setMuted } from './ui/sound';

// KataBomb entry. Routes: /katabomb (home) and /katabomb/r/:code (a room).
export default function KataBomb() {
  const [muted, setMutedState] = useState(isMuted);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <title>KataBomb · Lepak.gg</title>
      {/* Slim dark bar so the game screen reads as one piece. */}
      <header className="on-dark flex h-12 shrink-0 items-stretch justify-between border-b border-paper/15 bg-night text-paper">
        <Link
          to="/hub"
          className="flex items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-paper" />
          {SITE.wordmark}
        </Link>
        <div className="flex items-stretch">
          <Link
            to="/katabomb"
            className="flex min-h-11 items-center gap-2 px-4 font-mono text-sm font-bold uppercase no-underline"
          >
            <span aria-hidden="true" className="inline-block size-2 rounded-full bg-hot" />
            {KB.name}
          </Link>
          <button
            type="button"
            aria-pressed={!muted}
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center border-0 border-l border-paper/15 bg-transparent px-4 font-mono text-sm font-bold text-paper uppercase"
          >
            {muted ? KB.soundOff : KB.soundOn}
          </button>
        </div>
      </header>
      {/* Lobby and results may scroll inside here; the game screen fits exactly. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Routes>
          <Route index element={<Home />} />
          <Route path="r/:code" element={<RoomPage />} />
        </Routes>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { KB } from './copy';
import { Home } from './ui/Home';
import { RoomPage } from './ui/RoomPage';
import { isMuted, setMuted } from './ui/sound';
import { AppHeader } from '../../components/AppHeader';

// KataBomb entry. Routes: /katabomb (home) and /katabomb/r/:code (a room).
export default function KataBomb() {
  const [muted, setMutedState] = useState(isMuted);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <title>KataBomb · Lepak.gg</title>
      <AppHeader dark app={{ name: KB.name, to: '/katabomb', accent: '#ff7a45' }}>
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
      </AppHeader>
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

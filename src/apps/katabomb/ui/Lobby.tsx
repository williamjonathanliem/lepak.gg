import { useEffect, useState } from 'react';
import { Button } from '../../../components/Button';
import { HandNote } from '../../../components/Doodle';
import { SectionLabel } from '../../../components/SectionLabel';
import { DIFFICULTY_LABEL, KB } from '../copy';
import { AVATAR_EMOJIS, canStart } from '../logic/game';
import { LIMITS, type Difficulty, type Settings } from '../logic/types';
import type { Room } from '../net/useRoom';
import { AVATAR_COLORS } from './avatar';
import { Chat } from './Chat';
import { PlayerTags } from './PlayerTags';

interface LobbyProps {
  room: Room;
  code: string;
  onLeave: () => void;
}

/** Pick your own avatar colour and emoji. Everyone sees it in the game. */
function AvatarPicker({ room }: { room: Room }) {
  const me = room.state!.players.find((p) => p.id === room.selfId)!;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 font-mono text-sm uppercase">Your look</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar colour">
        {AVATAR_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={me.color === i}
            aria-label={`Colour ${i + 1}`}
            onClick={() => room.setAvatar({ color: i })}
            className={`size-9 cursor-pointer border-3 ${me.color === i ? 'border-ink shadow-hard-sm' : 'border-transparent'}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Avatar emoji">
        <button
          type="button"
          role="radio"
          aria-checked={me.emoji === null}
          onClick={() => room.setAvatar({ emoji: null })}
          className={`size-10 cursor-pointer border-2 bg-paper font-black ${me.emoji === null ? 'border-ink' : 'border-transparent'}`}
        >
          {me.nickname.slice(0, 1).toUpperCase()}
        </button>
        {AVATAR_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={me.emoji === e}
            onClick={() => room.setAvatar({ emoji: e })}
            className={`size-10 cursor-pointer border-2 bg-paper text-xl ${me.emoji === e ? 'border-ink' : 'border-transparent'}`}
          >
            {e}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type Tab = 'room' | 'players' | 'settings' | 'chat';
const TABS: { id: Tab; label: string }[] = [
  { id: 'room', label: 'Room' },
  { id: 'players', label: 'Players' },
  { id: 'settings', label: 'Settings' },
  { id: 'chat', label: 'Chat' },
];

/**
 * Lobby. Wide screens: four columns. Narrow screens: tabs, one panel at a time.
 * Either way the page itself never scrolls; long panels scroll inside.
 * Start / Ready lives in a bar at the bottom so it's always in reach.
 */
export function Lobby({ room, code, onLeave }: LobbyProps) {
  const state = room.state!;
  const me = state.players.find((p) => p.id === room.selfId);
  const link = `${window.location.origin}/katabomb/r/${code}`;
  const [tab, setTab] = useState<Tab>('room');
  const seated = state.players.filter((p) => p.playing).length;
  const panel = (id: Tab, extra = '') =>
    `min-h-0 overflow-y-auto bg-paper px-gutter py-6 ${tab === id ? '' : 'max-lg:hidden'} ${extra}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Lobby sections"
        className="flex border-b-3 border-ink lg:hidden"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-12 flex-1 cursor-pointer border-0 font-mono text-xs font-bold uppercase not-last:border-r-3 not-last:border-ink ${tab === t.id ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
          >
            {t.label}
            {t.id === 'players' && ` ${seated}`}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-[3px] bg-ink lg:grid-cols-4">
        {/* Code + invite */}
        <section aria-labelledby="code-h" className={panel('room', 'flex flex-col gap-5')}>
          <SectionLabel number="002" title={KB.lobby} />
          <h1 id="code-h" className="m-0">
            <span className="sr-only">Room code </span>
            <span className="block font-mono text-[clamp(56px,7vw,104px)] leading-none font-bold tracking-[0.08em]">
              {code}
            </span>
          </h1>
          <HandNote rotate={-4}>send this to the group chat</HandNote>
          <Invite link={link} />
          <button
            type="button"
            onClick={onLeave}
            className="mt-auto inline-flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 font-mono text-sm underline"
          >
            {room.isHost ? KB.closeRoom : KB.leave}
          </button>
        </section>

        {/* Players */}
        <section aria-labelledby="players-h" className={panel('players', 'flex flex-col gap-4')}>
          <h2 id="players-h" className="m-0 text-[28px] font-black uppercase">
            {KB.players}{' '}
            <span className="font-mono text-base font-normal">
              {seated}/{LIMITS.maxPlayers}
            </span>
          </h2>
          <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
            {state.players.map((p) => (
              <li
                key={p.id}
                className="flex min-h-12 items-center justify-between gap-3 border-ink px-4 py-2 not-last:border-b-3"
              >
                <span className={`truncate text-lg font-bold ${p.connected ? '' : 'text-mute'}`}>
                  {p.emoji ? `${p.emoji} ` : ''}
                  {p.nickname}
                </span>
                <span className="flex items-center gap-2">
                  <PlayerTags room={room} player={p} />
                  {room.isHost && p.id !== room.selfId && (
                    <button
                      type="button"
                      onClick={() => room.kick(p.id)}
                      aria-label={`${KB.kick} ${p.nickname}`}
                      className="min-h-11 cursor-pointer border-2 border-ink bg-paper px-2 font-mono text-xs font-bold uppercase hover:bg-ink hover:text-paper"
                    >
                      {KB.kick}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {me && <AvatarPicker room={room} />}
        </section>

        {/* Settings */}
        <div className={panel('settings', 'p-0!')}>
          <SettingsPanel room={room} />
        </div>

        {/* Chat */}
        <section
          aria-labelledby="chat-h"
          className={`on-dark flex min-h-0 flex-col bg-ink text-paper ${tab === 'chat' ? '' : 'max-lg:hidden'}`}
        >
          <h2
            id="chat-h"
            className="m-0 border-b-3 border-paper px-gutter py-4 text-[28px] font-black uppercase"
          >
            Chat
          </h2>
          <Chat room={room} className="min-h-0 flex-1" />
        </section>
      </div>

      {/* always-visible action bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t-3 border-ink bg-paper px-gutter py-3">
        <p className="m-0 font-mono text-sm">
          {room.isHost ? (canStart(state) ? `${seated} ready to go` : KB.needTwo) : KB.waitingHost}
        </p>
        {room.isHost ? (
          <Button
            onClick={room.start}
            disabled={!canStart(state)}
            className="h-14 px-8 text-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {KB.start}
          </Button>
        ) : (
          me?.playing && (
            <Button
              aria-pressed={me.ready}
              onClick={() => room.toggleReady(!me.ready)}
              className={`h-14 px-6 ${me.ready ? '' : 'bg-paper! text-ink!'}`}
            >
              {me.ready ? `✓ ${KB.ready}` : KB.imReady}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function Invite({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!showQr || qr) return;
    let alive = true;
    void import('qrcode').then((QR) =>
      QR.toDataURL(link, {
        margin: 1,
        width: 240,
        color: { dark: '#000000', light: '#f9fafb' },
      }).then((url) => alive && setQr(url)),
    );
    return () => {
      alive = false;
    };
  }, [showQr, qr, link]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="h-12 px-5"
        >
          {copied ? KB.copied : KB.copyLink}
        </Button>
        <button
          type="button"
          aria-expanded={showQr}
          onClick={() => setShowQr((v) => !v)}
          className="min-h-12 cursor-pointer border-3 border-ink bg-paper px-5 font-mono font-bold uppercase"
        >
          {showQr ? KB.hideQr : KB.showQr}
        </button>
      </div>
      <p className="m-0 font-mono text-sm break-all text-mute">{link}</p>
      {showQr && (
        <div className="self-start border-3 border-ink p-2 shadow-hard">
          {qr ? (
            <img src={qr} width={240} height={240} alt={`QR code for ${link}`} />
          ) : (
            <div className="size-60" />
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ room }: { room: Room }) {
  const s = room.state!.settings;
  const edit = room.isHost;
  const set = (patch: Partial<Settings>) => room.changeSettings(patch);

  return (
    <section aria-labelledby="settings-h" className="flex flex-col gap-5 bg-paper px-gutter py-6">
      <h2 id="settings-h" className="m-0 text-[28px] font-black uppercase">
        {KB.settings}
      </h2>
      <Stepper
        label={KB.lives}
        value={s.lives}
        range={LIMITS.lives}
        edit={edit}
        onChange={(lives) => set({ lives })}
      />
      <Stepper
        label={KB.fuse}
        value={s.turnSeconds}
        range={LIMITS.turnSeconds}
        edit={edit}
        onChange={(turnSeconds) => set({ turnSeconds })}
      />
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={!edit}>
        <legend className="mb-2 p-0 font-mono text-sm uppercase">{KB.difficulty}</legend>
        <div className="flex border-3 border-ink">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <label
              key={d}
              className={`flex min-h-11 flex-1 items-center justify-center font-mono text-sm font-bold uppercase not-last:border-r-3 not-last:border-ink has-focus-visible:outline-3 has-focus-visible:outline-ink ${s.difficulty === d ? 'bg-ink text-paper' : 'bg-paper'} ${edit ? 'cursor-pointer' : ''}`}
            >
              <input
                type="radio"
                name="difficulty"
                value={d}
                checked={s.difficulty === d}
                onChange={() => set({ difficulty: d })}
                className="sr-only"
              />
              {DIFFICULTY_LABEL[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center justify-between gap-4">
        <span className="font-mono text-sm uppercase">{KB.speedUp}</span>
        <input
          type="checkbox"
          checked={s.speedUp}
          disabled={!edit}
          onChange={(e) => set({ speedUp: e.target.checked })}
          className="size-6 accent-black"
        />
      </label>
      {!edit && <p className="m-0 font-mono text-sm text-mute">Only the host can change these.</p>}
    </section>
  );
}

interface StepperProps {
  label: string;
  value: number;
  range: readonly [number, number];
  edit: boolean;
  onChange: (v: number) => void;
}

function Stepper({ label, value, range, edit, onChange }: StepperProps) {
  const [min, max] = range;
  const btn =
    'size-11 cursor-pointer border-0 bg-ink font-mono text-xl font-bold text-paper disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-sm uppercase">{label}</span>
      <div className="flex items-stretch border-3 border-ink">
        {edit && (
          <button
            type="button"
            aria-label={`Less ${label}`}
            disabled={value <= min}
            onClick={() => onChange(value - 1)}
            className={btn}
          >
            −
          </button>
        )}
        <output
          aria-live="polite"
          className="flex w-14 items-center justify-center font-mono text-xl font-bold"
        >
          {value}
        </output>
        {edit && (
          <button
            type="button"
            aria-label={`More ${label}`}
            disabled={value >= max}
            onClick={() => onChange(value + 1)}
            className={btn}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

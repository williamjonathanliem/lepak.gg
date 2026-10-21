import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { firebaseEnabled } from '../../lib/firebase';
import { QUALITY_LABEL } from '../../lib/rtc/link';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../lib/roomCode';
import { formatBytes, speedAndEta } from './logic/transfer';
import { useDrop, type DropItem } from './net/useDrop';
import { useNow } from '../katabomb/ui/useNow';
import { AppHeader } from '../../components/AppHeader';

const clock = () => Date.now();

// Device Drop: /drop (home), /drop/r/:code (the drop room).
// Files go straight between the two devices (WebRTC). The server only helps them find each other.

const ACCENT = '#4fd1e8';

export default function DeviceDrop() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader app={{ name: 'Device Drop', to: '/drop', accent: ACCENT }} />
      <Routes>
        <Route index element={<Home />} />
        <Route path="r/:code" element={<RoomRoute />} />
      </Routes>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function join(e: FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(code)) return setError('Codes are 4 letters or numbers.');
    navigate(`/drop/r/${normalizeRoomCode(code)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Device Drop · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Device Drop.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Phone to laptop, laptop to phone. No cable, no WhatsApp-to-self. Files go straight between
          your two devices and are never stored on a server.
        </p>
      </div>
      {!firebaseEnabled && (
        <p className="m-0 font-mono text-sm">
          Device Drop needs the Lepak server, which this copy is not set up for.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section
          className="flex flex-col gap-3 border-3 border-ink p-5 shadow-hard"
          style={{ background: ACCENT }}
        >
          <h2 className="m-0 text-2xl font-black uppercase">Start a drop</h2>
          <p className="m-0">Open this on one device, then scan the QR code with the other.</p>
          <button
            type="button"
            disabled={!firebaseEnabled}
            onClick={() => navigate(`/drop/r/${generateRoomCode()}`, { state: { create: true } })}
            className="push mt-auto h-14 cursor-pointer self-start border-3 border-ink bg-ink px-6 font-mono font-bold text-paper uppercase shadow-hard disabled:opacity-40"
          >
            Start
          </button>
        </section>
        <form noValidate onSubmit={join} className="flex flex-col gap-3 border-3 border-ink p-5">
          <h2 className="m-0 text-2xl font-black uppercase">Join</h2>
          <label htmlFor="d-code" className="font-mono text-xs uppercase">
            Code on the other device
          </label>
          <div className="flex">
            <input
              id="d-code"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="KJRW"
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              className="h-14 w-32 border-3 border-ink bg-paper px-3 font-mono text-xl tracking-[0.25em] uppercase"
            />
            <button
              type="submit"
              className="h-14 cursor-pointer border-3 border-l-0 border-ink bg-ink px-5 font-mono font-bold text-paper uppercase"
            >
              Join
            </button>
          </div>
          <p role="alert" className="m-0 min-h-6 font-mono text-sm font-bold">
            {error ? `! ${error}` : ''}
          </p>
        </form>
      </div>
      <p className="m-0 font-mono text-xs text-mute">
        Works best on the same Wi-Fi. Some school or office networks block direct connections; if it
        gets stuck on "Connecting", try mobile data on one device.
      </p>
    </main>
  );
}

function RoomRoute() {
  const { code: raw = '' } = useParams();
  const code = normalizeRoomCode(raw);
  const create = (useLocation().state as { create?: boolean } | null)?.create === true;
  if (!isValidRoomCode(code)) return <Navigate to="/drop" replace />;
  if (code !== raw) return <Navigate to={`/drop/r/${code}`} replace />;
  return <Room key={code} code={code} create={create} />;
}

function Room({ code, create }: { code: string; create: boolean }) {
  const drop = useDrop(code, create);
  const link = `${window.location.origin}/drop/r/${code}`;

  if (drop.status === 'not-found') {
    return <Message text={`No drop with code ${code}. It may have closed. Start a new one?`} />;
  }
  if (drop.status === 'full') {
    return <Message text="This drop is already connecting two other devices." />;
  }
  if (drop.status === 'closed') {
    return <Message text="The other device closed this drop. Start a new one?" />;
  }
  if (drop.status === 'blocked') {
    return (
      <Message text="The Lepak server isn't set up for Device Drop yet (database rules missing). Ask whoever runs this site to publish them." />
    );
  }
  if (drop.status === 'error') {
    return <Message text="Could not reach the server. Check your internet and try again." />;
  }

  const connected = drop.status === 'connected';
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-gutter py-5">
      <title>{`Drop ${code} · Lepak.gg`}</title>
      <StatusBar drop={drop} code={code} />
      {!connected && (drop.status === 'waiting' || drop.isHost) && (
        <Invite link={link} code={code} />
      )}
      {drop.status === 'lost' && (
        <button
          type="button"
          onClick={drop.reconnect}
          className="push h-12 cursor-pointer self-start border-3 border-ink bg-paper px-5 font-mono font-bold uppercase shadow-hard"
        >
          Reconnect
        </button>
      )}
      <Sender drop={drop} connected={connected} />
      <Items drop={drop} />
    </main>
  );
}

type Drop = ReturnType<typeof useDrop>;

function StatusBar({ drop, code }: { drop: Drop; code: string }) {
  const text: Record<string, string> = {
    connecting: 'Connecting to the server...',
    waiting: 'Waiting for your other device...',
    linking: `Connecting${drop.otherName ? ` to ${drop.otherName}` : ''}...`,
    connected: `Connected to ${drop.otherName ?? 'your other device'}`,
    lost: 'Connection lost.',
  };
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-3 border-ink px-4 py-3 font-mono text-sm"
      style={{ background: drop.status === 'connected' ? ACCENT : undefined }}
    >
      <span className="font-bold">
        <span
          aria-hidden="true"
          className={`mr-2 inline-block size-2.5 ${drop.status === 'connected' ? 'bg-ink' : 'animate-pulse bg-mute'}`}
        />
        {text[drop.status] ?? ''}
      </span>
      <span>
        Code <b className="tracking-[0.2em]">{code}</b>
        {drop.status === 'connected' && <> · {QUALITY_LABEL[drop.quality]}</>}
      </span>
    </div>
  );
}

function Invite({ link, code }: { link: string; code: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    void import('qrcode').then((QR) =>
      QR.toDataURL(link, {
        margin: 1,
        width: 220,
        color: { dark: '#000000', light: '#f9fafb' },
      }).then((url) => alive && setQr(url)),
    );
    return () => {
      alive = false;
    };
  }, [link]);
  return (
    <section className="flex flex-wrap items-center gap-5 border-3 border-ink p-4">
      {qr ? (
        <img
          src={qr}
          alt={`QR code for ${link}`}
          width={180}
          height={180}
          className="border-3 border-ink"
        />
      ) : (
        <div className="size-[186px] border-3 border-ink" />
      )}
      <div className="flex flex-col gap-2">
        <p className="m-0 text-lg font-bold">Scan with your other device,</p>
        <p className="m-0">
          or open <b>{link.replace(/^https?:\/\//, '').replace(/\/drop\/r\/.*/, '/drop')}</b> and
          type <b className="font-mono tracking-[0.2em]">{code}</b>
        </p>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="min-h-11 cursor-pointer self-start border-3 border-ink bg-paper px-4 font-mono text-sm font-bold uppercase"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </section>
  );
}

function Sender({ drop, connected }: { drop: Drop; connected: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [text, setText] = useState('');

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) drop.sendFiles(e.dataTransfer.files);
  }

  return (
    <section className="grid gap-4 md:grid-cols-[3fr_2fr]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex min-h-44 flex-col items-center justify-center gap-3 border-3 border-dashed border-ink p-5 text-center transition-colors ${over ? 'bg-[#4fd1e8]' : ''}`}
      >
        <p className="m-0 text-2xl font-black uppercase">{over ? 'Let go!' : 'Drop files here'}</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="push h-12 cursor-pointer border-3 border-ink bg-ink px-5 font-mono font-bold text-paper uppercase shadow-hard"
        >
          Pick files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) drop.sendFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {!connected && (
          <p className="m-0 font-mono text-xs text-mute">
            They'll send once the other device connects.
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          drop.sendText(text);
          setText('');
        }}
        className="flex flex-col gap-2 border-3 border-ink p-4"
      >
        <label htmlFor="d-text" className="font-mono text-xs uppercase">
          Send text or a link
        </label>
        <textarea
          id="d-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://..."
          className="min-h-20 flex-1 border-3 border-ink bg-paper p-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="min-h-11 cursor-pointer border-3 border-ink bg-paper font-mono text-sm font-bold uppercase disabled:opacity-40"
        >
          Send text
        </button>
      </form>
    </section>
  );
}

function Items({ drop }: { drop: Drop }) {
  if (!drop.items.length) return null;
  return (
    <section aria-label="Transfers">
      <ul className="m-0 flex list-none flex-col border-3 border-ink p-0">
        {drop.items.map((item) => (
          <ItemRow key={item.id} item={item} onCancel={() => drop.cancel(item.id)} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ item, onCancel }: { item: DropItem; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const pct = item.size ? Math.round((item.done / item.size) * 100) : 100;
  const active = item.status === 'sending';
  const now = useNow(clock, active, 500);
  const { speed, eta } = speedAndEta(item.done, item.size, item.startedAt, now);
  const isImage = item.url && item.mime.startsWith('image/');
  const label: Record<string, string> = {
    waiting: 'Waiting',
    sending: `${pct}%${speed ? ` · ${formatBytes(speed)}/s` : ''}${eta !== null ? ` · ${Math.ceil(eta)}s left` : ''}`,
    done: item.dir === 'in' ? 'Received' : 'Sent',
    cancelled: 'Cancelled',
    failed: 'Failed',
  };

  return (
    <li className="flex flex-col gap-2 border-ink px-4 py-3 not-last:border-b-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="font-mono text-lg font-bold">
          {item.dir === 'in' ? '↓' : '↑'}
        </span>
        {isImage && (
          <img src={item.url} alt="" className="size-12 border-2 border-ink object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-bold">{item.kind === 'text' ? item.text : item.name}</p>
          <p className="m-0 font-mono text-xs text-mute">
            {item.kind === 'file' && `${formatBytes(item.size)} · `}
            {label[item.status]}
          </p>
        </div>
        {item.url && (
          <a
            href={item.url}
            download={item.name}
            className="flex min-h-11 items-center border-3 border-ink px-3 font-mono text-sm font-bold uppercase no-underline"
            style={{ background: ACCENT }}
          >
            Save
          </a>
        )}
        {item.kind === 'text' && item.dir === 'in' && (
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(item.text ?? '').then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-3 font-mono text-sm font-bold uppercase"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
        {(active || item.status === 'waiting') && item.dir === 'out' && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={`Cancel ${item.name}`}
            className="min-h-11 cursor-pointer border-3 border-ink bg-paper px-3 font-mono text-sm font-bold"
          >
            ✕
          </button>
        )}
      </div>
      {active && (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${item.name} progress`}
          className="h-3 border-2 border-ink"
        >
          <div className="h-full bg-ink transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
    </li>
  );
}

function Message({ text }: { text: string }) {
  return (
    <main className="flex flex-1 flex-col items-start gap-6 px-gutter py-16">
      <p role="status" className="m-0 font-mono text-lg">
        {text}
      </p>
      <Link to="/drop" className="inline-flex min-h-11 items-center font-mono underline">
        Back to Device Drop
      </Link>
    </main>
  );
}

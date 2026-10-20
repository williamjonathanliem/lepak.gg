import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MAX_LENGTH } from '../net/transport';
import type { Room } from '../net/useRoom';

/** Room chat. Messages scroll inside the panel; the page never scrolls. */
export function Chat({ room, className = '' }: { room: Room; className?: string }) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const hostName = room.state?.players.find((p) => p.id === room.state?.hostId)?.nickname;

  // Stick to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [room.chat.length]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    room.sendChat(text);
    setText('');
  }

  return (
    <section aria-label="Chat" className={`flex min-h-0 flex-col ${className}`}>
      <ol
        ref={listRef}
        aria-live="polite"
        className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-3 text-sm"
      >
        {hostName && <li className="font-mono text-xs text-mute-dark">{hostName} is the host.</li>}
        {room.chat.map((m) => (
          <li key={m.id} className="break-words">
            <strong className={m.from === room.selfId ? 'underline' : ''}>{m.nick}</strong>{' '}
            <span className="text-mute-dark">{m.text}</span>
          </li>
        ))}
      </ol>
      <form onSubmit={onSubmit} className="flex border-t border-paper/15">
        <label htmlFor="chat-input" className="sr-only">
          Chat message
        </label>
        <input
          id="chat-input"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          autoComplete="off"
          placeholder="Type here to chat..."
          onChange={(e) => setText(e.target.value)}
          className="h-12 min-w-0 flex-1 border-0 bg-transparent px-3 font-mono text-sm text-paper placeholder:text-mute-dark"
        />
        <button
          type="submit"
          className="min-h-12 min-w-14 cursor-pointer border-0 bg-paper px-3 font-mono text-sm font-bold text-ink uppercase"
        >
          Send
        </button>
      </form>
    </section>
  );
}

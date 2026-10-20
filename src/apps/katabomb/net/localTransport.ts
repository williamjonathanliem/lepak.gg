import type { GameState } from '../logic/types';
import type { Intent } from './messages';
import { CHAT_HISTORY, type ChatMessage, type RoomTransport, type Unsubscribe } from './transport';

// Rooms between browser tabs on one device. Used in development and when Firebase
// isn't configured. Tabs talk over BroadcastChannel; the latest snapshot also sits in
// localStorage so a tab that opens later can catch up.

type Message =
  | { t: 'state'; state: GameState }
  | { t: 'intent'; from: string; data: unknown }
  | { t: 'typing'; from: string; text: string }
  | { t: 'chat'; message: ChatMessage }
  | { t: 'ping'; from: string }
  | { t: 'bye'; from: string };

const HEARTBEAT_MS = 1000;
const OFFLINE_AFTER_MS = 3500;

function snapshotKey(code: string) {
  return `lepak.katabomb.room.${code}`;
}

function chatKey(code: string) {
  return `lepak.katabomb.chat.${code}`;
}

function readChat(code: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(chatKey(code)) ?? '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

function readSnapshot(code: string): GameState | null {
  try {
    const raw = localStorage.getItem(snapshotKey(code));
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export class LocalTransport implements RoomTransport {
  readonly kind = 'local' as const;
  private channel: BroadcastChannel;
  private stateCbs = new Set<(s: GameState | null) => void>();
  private intentCbs = new Set<(from: string, data: unknown) => void>();
  private typingCbs = new Set<(from: string, text: string) => void>();
  private presenceCbs = new Set<(online: ReadonlySet<string>) => void>();
  private chatCbs = new Set<(messages: ChatMessage[]) => void>();
  private chat: ChatMessage[];
  private lastSeen = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    readonly code: string,
    readonly selfId: string,
  ) {
    this.chat = readChat(code);
    this.channel = new BroadcastChannel(`lepak-katabomb-${code}`);
    this.channel.onmessage = (e: MessageEvent<Message>) => this.receive(e.data);
    this.lastSeen.set(selfId, Date.now());
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.post({ t: 'ping', from: selfId });
    window.addEventListener('pagehide', this.sayBye);
  }

  now() {
    return Date.now();
  }

  onState(cb: (s: GameState | null) => void): Unsubscribe {
    this.stateCbs.add(cb);
    cb(readSnapshot(this.code));
    return () => this.stateCbs.delete(cb);
  }

  publishState(state: GameState) {
    try {
      localStorage.setItem(snapshotKey(this.code), JSON.stringify(state));
    } catch {
      // storage full or blocked: tabs that are already open still get the broadcast
    }
    this.post({ t: 'state', state });
    this.stateCbs.forEach((cb) => cb(state));
  }

  sendIntent(intent: Intent) {
    this.post({ t: 'intent', from: this.selfId, data: intent });
    // the host might be this tab
    this.intentCbs.forEach((cb) => cb(this.selfId, intent));
  }

  onIntent(cb: (from: string, data: unknown) => void): Unsubscribe {
    this.intentCbs.add(cb);
    return () => this.intentCbs.delete(cb);
  }

  sendTyping(text: string) {
    this.post({ t: 'typing', from: this.selfId, text });
  }

  onTyping(cb: (from: string, text: string) => void): Unsubscribe {
    this.typingCbs.add(cb);
    return () => this.typingCbs.delete(cb);
  }

  sendChat(nick: string, text: string) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      from: this.selfId,
      nick,
      text,
      at: Date.now(),
    };
    this.post({ t: 'chat', message });
    this.addChat(message);
  }

  onChat(cb: (messages: ChatMessage[]) => void): Unsubscribe {
    this.chatCbs.add(cb);
    cb(this.chat);
    return () => this.chatCbs.delete(cb);
  }

  private addChat(message: ChatMessage) {
    this.chat = [...this.chat, message].slice(-CHAT_HISTORY);
    try {
      localStorage.setItem(chatKey(this.code), JSON.stringify(this.chat));
    } catch {
      // ignore
    }
    this.chatCbs.forEach((cb) => cb(this.chat));
  }

  onPresence(cb: (online: ReadonlySet<string>) => void): Unsubscribe {
    this.presenceCbs.add(cb);
    cb(this.online());
    return () => this.presenceCbs.delete(cb);
  }

  close() {
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.sayBye);
    this.sayBye();
    this.channel.close();
    this.stateCbs.clear();
    this.intentCbs.clear();
    this.typingCbs.clear();
    this.presenceCbs.clear();
    this.chatCbs.clear();
  }

  private sayBye = () => {
    this.post({ t: 'bye', from: this.selfId });
  };

  private post(msg: Message) {
    try {
      this.channel.postMessage(msg);
    } catch {
      // channel already closed
    }
  }

  private receive(msg: Message) {
    switch (msg.t) {
      case 'state':
        this.stateCbs.forEach((cb) => cb(msg.state));
        break;
      case 'intent':
        this.seen(msg.from);
        this.intentCbs.forEach((cb) => cb(msg.from, msg.data));
        break;
      case 'typing':
        this.typingCbs.forEach((cb) => cb(msg.from, msg.text));
        break;
      case 'chat':
        this.addChat(msg.message);
        break;
      case 'ping':
        this.seen(msg.from);
        break;
      case 'bye':
        this.lastSeen.delete(msg.from);
        this.emitPresence();
        break;
    }
  }

  private seen(id: string) {
    const isNew = !this.lastSeen.has(id);
    this.lastSeen.set(id, Date.now());
    if (isNew) this.emitPresence();
  }

  private heartbeat() {
    this.lastSeen.set(this.selfId, Date.now());
    this.post({ t: 'ping', from: this.selfId });
    const cutoff = Date.now() - OFFLINE_AFTER_MS;
    let changed = false;
    for (const [id, at] of this.lastSeen) {
      if (at < cutoff) {
        this.lastSeen.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitPresence();
  }

  private online(): Set<string> {
    return new Set(this.lastSeen.keys());
  }

  private emitPresence() {
    const online = this.online();
    this.presenceCbs.forEach((cb) => cb(online));
  }
}

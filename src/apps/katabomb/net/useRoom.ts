import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDictionary, type Dictionary } from '../logic/dictionary';
import {
  backToLobby,
  createGame,
  joinGame,
  leaveGame,
  rejectWord,
  setConnected,
  setHost,
  setReady,
  setStyle,
  startGame,
  submitWord,
  tick,
  updateSettings,
  type Env,
} from '../logic/game';
import type { GameState, Settings } from '../logic/types';
import { openRoom } from './connect';
import { parseIntent, type Intent } from './messages';
import { censorText } from '../../../lib/profanity';
import { CHAT_MAX_LENGTH, type ChatMessage, type RoomTransport } from './transport';

const TICK_MS = 100;
const HOST_GONE_MS = 2500; // how long the host can vanish before someone takes over
const TYPING_THROTTLE_MS = 80;

export type RoomStatus = 'connecting' | 'ready' | 'not-found' | 'full' | 'error';

export interface Room {
  status: RoomStatus;
  state: GameState | null;
  selfId: string | null;
  isHost: boolean;
  mode: RoomTransport['kind'] | null;
  online: ReadonlySet<string>;
  typing: Readonly<Record<string, string>>;
  chat: readonly ChatMessage[];
  /** Server-aligned clock for the fuse display. */
  now: () => number;
  dictReady: boolean;
  // everyone
  submit: (word: string) => void;
  setTyping: (text: string) => void;
  sendChat: (text: string) => void;
  toggleReady: (ready: boolean) => void;
  setAvatar: (style: { color?: number | null; emoji?: string | null }) => void;
  leave: () => void;
  // host only
  start: () => void;
  changeSettings: (patch: Partial<Settings>) => void;
  toLobby: () => void;
}

/**
 * Connects to a KataBomb room. Every player runs this; whoever is host also runs
 * the rules (checks words, runs the fuse) and broadcasts the new state.
 */
export function useRoom(code: string, nickname: string, create: boolean): Room {
  const [transport, setTransport] = useState<RoomTransport | null>(null);
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [state, setState] = useState<GameState | null>(null);
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());
  // Live typing, tagged with the turn it belongs to so old text never shows on a new turn.
  const [typingRaw, setTypingMap] = useState<Record<string, { text: string; turn: string }>>({});
  const [dictReady, setDictReady] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const stateRef = useRef<GameState | null>(null);
  const onlineRef = useRef<ReadonlySet<string>>(new Set());
  const dictRef = useRef<Dictionary | null>(null);
  const hostGoneSince = useRef<number | null>(null);
  const lastTypingSent = useRef(0);
  const pendingTyping = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selfId = transport?.selfId ?? null;
  const isHost = !!state && !!selfId && state.hostId === selfId;

  // ---- connect ----
  useEffect(() => {
    let t: RoomTransport | null = null;
    let cancelled = false;
    openRoom(code)
      .then((opened) => {
        if (cancelled) return opened.close();
        t = opened;
        setTransport(opened);
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
      t?.close();
    };
  }, [code]);

  const now = useCallback(() => transport?.now() ?? Date.now(), [transport]);

  const env = useCallback(
    (): Env => ({
      now: transport?.now() ?? Date.now(),
      rng: Math.random,
      prompts: dictRef.current?.prompts ?? [],
    }),
    [transport],
  );

  /** Host only: save and broadcast a new state. */
  const commit = useCallback(
    (next: GameState) => {
      if (!transport || next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      transport.publishState(next);
    },
    [transport],
  );

  const ensureDictionary = useCallback(async () => {
    if (dictRef.current) return dictRef.current;
    const dict = await loadDictionary('en');
    dictRef.current = dict;
    setDictReady(true);
    return dict;
  }, []);

  // ---- listen ----
  useEffect(() => {
    if (!transport) return;
    let first = true;
    const offState = transport.onState((incoming) => {
      const wasFirst = first;
      first = false;
      if (!incoming) {
        if (wasFirst && create) {
          commit(createGame({ id: transport.selfId, nickname }));
          setStatus('ready');
        } else if (wasFirst) {
          setStatus('not-found');
        }
        return;
      }
      // Ignore echoes older than what the host already has.
      const current = stateRef.current;
      if (current && current.hostId === transport.selfId && incoming.seq < current.seq) return;
      stateRef.current = incoming;
      setState(incoming);
      setStatus('ready');
      if (wasFirst) transport.sendIntent({ type: 'join', nickname });
    });
    const offPresence = transport.onPresence((ids) => {
      onlineRef.current = ids;
      setOnline(ids);
    });
    const offTyping = transport.onTyping((from, text) => {
      const turn = turnKey(stateRef.current);
      setTypingMap((m) =>
        m[from]?.text === text && m[from]?.turn === turn ? m : { ...m, [from]: { text, turn } },
      );
    });
    const offChat = transport.onChat(setChat);
    return () => {
      offState();
      offPresence();
      offTyping();
      offChat();
    };
  }, [transport, create, nickname, commit]);

  // ---- host: handle intents ----
  useEffect(() => {
    if (!transport || !isHost) return;
    void ensureDictionary();
    return transport.onIntent((from, data) => {
      const intent = parseIntent(data);
      const s = stateRef.current;
      if (!intent || !s || s.hostId !== transport.selfId) return;
      commit(applyIntent(s, from, intent, dictRef.current, env()));
    });
  }, [transport, isHost, commit, env, ensureDictionary]);

  // ---- host: fuse + presence ----
  useEffect(() => {
    if (!transport || !isHost) return;
    const id = setInterval(() => {
      let s = stateRef.current;
      if (!s || s.hostId !== transport.selfId) return;
      for (const p of s.players) {
        const isOnline = onlineRef.current.has(p.id) || p.id === transport.selfId;
        if (p.connected !== isOnline) s = setConnected(s, p.id, isOnline);
      }
      s = tick(s, env());
      commit(s);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [transport, isHost, commit, env]);

  // ---- everyone: take over if the host disappears ----
  useEffect(() => {
    if (!transport || isHost || !state) return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const on = onlineRef.current;
      if (on.has(s.hostId)) {
        hostGoneSince.current = null;
        return;
      }
      hostGoneSince.current ??= Date.now();
      if (Date.now() - hostGoneSince.current < HOST_GONE_MS) return;
      // First online person in seat order takes over, so only one tab does.
      const heir = s.players.find((p) => p.id !== s.hostId && on.has(p.id));
      if (heir?.id !== transport.selfId) return;
      hostGoneSince.current = null;
      void ensureDictionary().then(() => {
        const latest = stateRef.current;
        if (latest && !onlineRef.current.has(latest.hostId)) {
          commit(setHost(latest, transport.selfId));
        }
      });
    }, 500);
    return () => clearInterval(id);
  }, [transport, isHost, state, commit, ensureDictionary]);

  // ---- everyone: load words when a match is on, so anyone can take over as host ----
  useEffect(() => {
    if (state?.phase === 'playing') void ensureDictionary();
  }, [state?.phase, ensureDictionary]);

  // ---- actions ----
  const send = useCallback((intent: Intent) => transport?.sendIntent(intent), [transport]);

  const currentTurn = turnKey(state);
  const typing: Record<string, string> = {};
  for (const [id, t] of Object.entries(typingRaw)) if (t.turn === currentTurn) typing[id] = t.text;

  const hostDo = useCallback(
    (fn: (s: GameState) => GameState) => {
      const s = stateRef.current;
      if (s && transport && s.hostId === transport.selfId) commit(fn(s));
    },
    [transport, commit],
  );

  return {
    status,
    state,
    selfId,
    isHost,
    mode: transport?.kind ?? null,
    online,
    typing,
    chat,
    now,
    dictReady,
    submit: (word) => send({ type: 'submit', word }),
    setTyping: (text) => {
      // Throttled, but the last keystroke always goes out so others see the full word.
      if (pendingTyping.current) clearTimeout(pendingTyping.current);
      const wait = TYPING_THROTTLE_MS - (Date.now() - lastTypingSent.current);
      const fire = () => {
        lastTypingSent.current = Date.now();
        transport?.sendTyping(text.slice(0, 40));
      };
      if (wait <= 0) fire();
      else pendingTyping.current = setTimeout(fire, wait);
    },
    sendChat: (text) => {
      const clean = censorText(text.trim()).slice(0, CHAT_MAX_LENGTH);
      if (clean) transport?.sendChat(nickname.slice(0, 16), clean);
    },
    toggleReady: (ready) => send({ type: 'ready', ready }),
    setAvatar: (style) => send({ type: 'style', ...style }),
    leave: () => send({ type: 'leave' }),
    start: () => {
      void ensureDictionary().then(() => hostDo((s) => startGame(s, env())));
    },
    changeSettings: (patch) => hostDo((s) => updateSettings(s, patch)),
    toLobby: () => hostDo(backToLobby),
  };
}

/** Host: turn one player message into the next state. */
function applyIntent(
  s: GameState,
  from: string,
  intent: Intent,
  dict: Dictionary | null,
  env: Env,
): GameState {
  switch (intent.type) {
    case 'join': {
      const nickname = intent.nickname.trim().slice(0, 16) || 'kaki';
      return joinGame(s, { id: from, nickname }).state;
    }
    case 'ready':
      return setReady(s, from, intent.ready);
    case 'style':
      return setStyle(s, from, { color: intent.color, emoji: intent.emoji });
    case 'leave':
      return leaveGame(s, from, env);
    case 'submit': {
      if (!dict) return s; // still loading words; the player can retry
      const result = submitWord(s, from, intent.word, (w) => dict.words.has(w), env);
      if (result.ok) return result.state;
      if (result.reason === 'not-your-turn') return s;
      return rejectWord(s, from, intent.word, result.reason);
    }
  }
}

/** Identifies the current turn, so typing from an earlier turn can be ignored. */
function turnKey(s: GameState | null): string {
  return s?.turn ? `${s.turn.playerId}:${s.turn.startedAt}` : '';
}

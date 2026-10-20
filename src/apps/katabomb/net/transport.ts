import type { GameState } from '../logic/types';
import type { Intent } from './messages';

export type Unsubscribe = () => void;

export interface ChatMessage {
  id: string;
  from: string;
  nick: string;
  text: string;
  at: number;
}

export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 50;

/**
 * Everything KataBomb needs from "the network". Swappable:
 * - LocalTransport: tabs on one device (dev and offline play)
 * - FirebaseTransport: real rooms across devices
 */
export interface RoomTransport {
  readonly code: string;
  /** This player's id. Trusted: it comes from sign-in, not from the player. */
  readonly selfId: string;
  /** Short label for the UI, e.g. "this device only". */
  readonly kind: 'local' | 'firebase';

  /** Current time, aligned across devices (ms epoch). */
  now(): number;

  /** Latest room snapshot. Called with null if the room doesn't exist. */
  onState(cb: (state: GameState | null) => void): Unsubscribe;
  /** Host only: replace the room snapshot. */
  publishState(state: GameState): void;

  /** Send something to the host. */
  sendIntent(intent: Intent): void;
  /** Host only: hear from players. `fromId` is trusted. Data is unchecked. */
  onIntent(cb: (fromId: string, data: unknown) => void): Unsubscribe;

  /** Live typing preview, not saved. */
  sendTyping(text: string): void;
  onTyping(cb: (fromId: string, text: string) => void): Unsubscribe;

  /** Room chat. The callback gets the latest messages, oldest first. */
  sendChat(nick: string, text: string): void;
  onChat(cb: (messages: ChatMessage[]) => void): Unsubscribe;

  /** Ids of people with the room open right now. */
  onPresence(cb: (online: ReadonlySet<string>) => void): Unsubscribe;

  close(): void;
}

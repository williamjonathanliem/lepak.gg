import { firebaseEnabled } from '../../../lib/firebase';
import { getPlayerId } from '../../../lib/identity';
import { LocalTransport } from './localTransport';
import type { RoomTransport } from './transport';

const TAB_ID_KEY = 'lepak.katabomb.tabId';

/**
 * In "this device only" mode every tab must be its own player, so tabs can play each
 * other. sessionStorage survives a refresh, so a refreshed tab gets its seat back.
 */
function localTabId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const id = `${getPlayerId().slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;
    sessionStorage.setItem(TAB_ID_KEY, id);
    return id;
  } catch {
    return getPlayerId();
  }
}

/** Real rooms when Firebase is configured, same-device rooms otherwise. */
export async function openRoom(code: string): Promise<RoomTransport> {
  if (firebaseEnabled) {
    const { FirebaseTransport } = await import('./firebaseTransport');
    return FirebaseTransport.open(code);
  }
  return new LocalTransport(code, localTabId());
}

export const roomMode: RoomTransport['kind'] = firebaseEnabled ? 'firebase' : 'local';

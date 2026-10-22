import { getPlayerId } from './identity';

/** Headers for calls to our AI endpoints. The guest ID lets the server limit each person
 * rather than each Wi-Fi network (a whole campus can share one IP). */
export function aiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Lepak-Player': getPlayerId() };
}

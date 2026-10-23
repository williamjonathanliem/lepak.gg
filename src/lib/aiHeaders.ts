import { firebaseEnabled, getFirebase } from './firebase';
import { getPlayerId } from './identity';

/** Headers for calls to our AI endpoints. The server only answers signed-in guests (the
 * invisible Firebase sign-in), so this adds that token. The guest ID lets the server limit
 * each person rather than each Wi-Fi network (a whole campus can share one IP). */
export async function aiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Lepak-Player': getPlayerId(),
  };
  if (firebaseEnabled) {
    try {
      const { auth } = await getFirebase();
      const token = await auth.currentUser?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // No token: the server says "refresh and try again", which is the right fix anyway.
    }
  }
  return headers;
}

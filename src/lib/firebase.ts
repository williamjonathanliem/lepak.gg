// Firebase setup. The web config is public by design: security comes from the
// rules in database.rules.json, not from hiding these values.
// Values come from .env.local (see .env.example). Without them, apps fall back
// to "this device only" mode.

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(config.apiKey && config.databaseURL && config.projectId);

interface Firebase {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
  uid: string;
}

let ready: Promise<Firebase> | null = null;

/** reCAPTCHA site key for App Check (public). Without it, App Check is simply off. */
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

/**
 * App Check: every request to Firebase carries a short-lived token proving it came from
 * our real site in a real browser (checked invisibly by reCAPTCHA), so bots and scripts
 * that copy our public config get turned away once enforcement is on in the console.
 * Must start before anything else talks to Firebase.
 */
async function startAppCheck(app: FirebaseApp) {
  if (!recaptchaKey) return;
  if (import.meta.env.DEV) {
    // On localhost reCAPTCHA can't vouch for us. This prints a debug token in the console
    // once; add it in Firebase console > App Check > Apps > Manage debug tokens.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  });
}

/**
 * Starts Firebase and signs this browser in as an invisible guest (anonymous auth).
 * The uid stays the same on this browser until its site data is cleared.
 * Loaded on demand so pages that don't need it stay small.
 */
export function getFirebase(): Promise<Firebase> {
  if (!firebaseEnabled) return Promise.reject(new Error('Firebase is not configured'));
  ready ??= (async () => {
    const [{ initializeApp }, authMod, { getDatabase }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/database'),
    ]);
    const app = initializeApp(config);
    await startAppCheck(app);
    const auth = authMod.getAuth(app);
    await auth.authStateReady();
    const user = auth.currentUser ?? (await authMod.signInAnonymously(auth)).user;
    return { app, auth, db: getDatabase(app), uid: user.uid };
  })();
  ready.catch(() => {
    ready = null; // let the next call try again
  });
  return ready;
}

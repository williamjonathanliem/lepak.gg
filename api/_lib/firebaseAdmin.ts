// Firebase with full rights, for server functions only (it skips the database rules).
// firebase-admin needs Node 22+ (set in package.json "engines", which Vercel follows).
// Env (server only, never VITE_):
//   FIREBASE_SERVICE_ACCOUNT  the service account JSON, whole file on one line
//   FIREBASE_DATABASE_URL     optional; falls back to VITE_FIREBASE_DATABASE_URL

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { ServerValue, getDatabase } from 'firebase-admin/database';

let app: App | null = null;

export const adminConfigured = () =>
  Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT &&
    (process.env.FIREBASE_DATABASE_URL ?? process.env.VITE_FIREBASE_DATABASE_URL),
  );

function getApp(): App {
  app ??=
    getApps()[0] ??
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!) as object),
      databaseURL: process.env.FIREBASE_DATABASE_URL ?? process.env.VITE_FIREBASE_DATABASE_URL,
    });
  return app;
}

export const adminDb = () => getDatabase(getApp());

/** Filled in with the server's clock when written. */
export const serverTime = ServerValue.TIMESTAMP;

/** Who sent a request: see idToken.ts. */
export { userFrom } from './idToken.js';

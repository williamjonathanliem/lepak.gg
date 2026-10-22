// Firebase with full rights, for server functions only (it skips the database rules).
// Env (server only, never VITE_):
//   FIREBASE_SERVICE_ACCOUNT  the service account JSON, whole file on one line
//   FIREBASE_DATABASE_URL     optional; falls back to VITE_FIREBASE_DATABASE_URL

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

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

/** The signed-in Firebase user behind a request (guest or admin), or null. */
export async function userFrom(request: Request): Promise<string | null> {
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return null;
  try {
    return (await getAuth(getApp()).verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

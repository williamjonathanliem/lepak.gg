// Firebase with full rights, for server functions only (it skips the database rules).
// firebase-admin needs Node 22+ (set in package.json "engines", which Vercel follows).
// Env (server only, never VITE_):
//   FIREBASE_SERVICE_ACCOUNT  the service account JSON, whole file on one line
//   FIREBASE_DATABASE_URL     optional; falls back to VITE_FIREBASE_DATABASE_URL

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { ServerValue, getDatabase } from 'firebase-admin/database';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

// Google's public keys for Firebase sign-in tokens (jose caches them between requests).
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

/**
 * The signed-in Firebase user behind a request (guest or admin), or null.
 * Checks the ID token ourselves with jose instead of firebase-admin/auth: that one loads a
 * library that can't run on Vercel (it require()s an ES module).
 */
export async function userFrom(request: Request): Promise<string | null> {
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return null;
  try {
    const { project_id: projectId } = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!) as {
      project_id: string;
    };
    const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

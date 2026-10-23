// Who is behind a request: checks the guest's (or admin's) Firebase sign-in token.
// Kept apart from firebaseAdmin.ts so the AI routes can check sign-in without loading
// firebase-admin. Uses jose instead of firebase-admin/auth: that one loads a library that
// can't run on Vercel (it require()s an ES module).
// Env: the project id comes from FIREBASE_SERVICE_ACCOUNT, else VITE_FIREBASE_PROJECT_ID.

import { createRemoteJWKSet, jwtVerify } from 'jose';

// Google's public keys for Firebase sign-in tokens (jose caches them between requests).
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

/** The Firebase project tokens must come from, or null when the server doesn't know it. */
export function firebaseProjectId(): string | null {
  try {
    const account = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (account) return (JSON.parse(account) as { project_id?: string }).project_id ?? null;
  } catch {
    // fall through to the public project id
  }
  return process.env.VITE_FIREBASE_PROJECT_ID || null;
}

/** The signed-in Firebase user behind a request (guest or admin), or null. */
export async function userFrom(request: Request): Promise<string | null> {
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  const projectId = firebaseProjectId();
  if (!token || !projectId) return null;
  try {
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

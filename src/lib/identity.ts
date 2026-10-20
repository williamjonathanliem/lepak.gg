import { hasProfanity } from './profanity';
import { readStorage, writeStorage } from './storage';

export const NICKNAME_KEY = 'lepak.nickname';
export const PLAYER_ID_KEY = 'lepak.playerId';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;
const NICKNAME_CHARS = /^[\p{L}\p{N} _-]+$/u;

export type NicknameError = 'too-short' | 'too-long' | 'bad-chars' | 'profane';
export type NicknameResult = { ok: true; value: string } | { ok: false; error: NicknameError };

export function validateNickname(raw: string): NicknameResult {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < NICKNAME_MIN) return { ok: false, error: 'too-short' };
  if (value.length > NICKNAME_MAX) return { ok: false, error: 'too-long' };
  if (!NICKNAME_CHARS.test(value)) return { ok: false, error: 'bad-chars' };
  if (hasProfanity(value)) return { ok: false, error: 'profane' };
  return { ok: true, value };
}

export function getNickname(): string | null {
  const stored = readStorage(NICKNAME_KEY);
  if (stored === null) return null;
  const result = validateNickname(stored);
  return result.ok ? result.value : null;
}

/** Validates and saves. Returns the same result as validateNickname. */
export function saveNickname(raw: string): NicknameResult {
  const result = validateNickname(raw);
  if (result.ok) writeStorage(NICKNAME_KEY, result.value);
  return result;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable random id for this browser. Created on first call. */
export function getPlayerId(): string {
  const stored = readStorage(PLAYER_ID_KEY);
  if (stored && UUID.test(stored)) return stored;
  const id = crypto.randomUUID();
  writeStorage(PLAYER_ID_KEY, id);
  return id;
}

import {
  NICKNAME_KEY,
  PLAYER_ID_KEY,
  getNickname,
  getPlayerId,
  saveNickname,
  validateNickname,
} from './identity';

describe('validateNickname', () => {
  it('accepts a normal nickname and trims it', () => {
    expect(validateNickname('  kopiboi  ')).toEqual({ ok: true, value: 'kopiboi' });
  });

  it('collapses inner whitespace', () => {
    expect(validateNickname('teh   tarik')).toEqual({ ok: true, value: 'teh tarik' });
  });

  it('allows letters, numbers, spaces, _ and -', () => {
    expect(validateNickname('Ali_99-x y').ok).toBe(true);
  });

  it('rejects too short', () => {
    expect(validateNickname(' a ')).toEqual({ ok: false, error: 'too-short' });
  });

  it('rejects too long', () => {
    expect(validateNickname('a'.repeat(17))).toEqual({ ok: false, error: 'too-long' });
  });

  it('accepts exactly 2 and 16 characters', () => {
    expect(validateNickname('ab').ok).toBe(true);
    expect(validateNickname('a'.repeat(16)).ok).toBe(true);
  });

  it('rejects other symbols', () => {
    expect(validateNickname('kopi!')).toEqual({ ok: false, error: 'bad-chars' });
    expect(validateNickname('<b>hi</b>')).toEqual({ ok: false, error: 'bad-chars' });
  });

  it('rejects profanity', () => {
    expect(validateNickname('fuck')).toEqual({ ok: false, error: 'profane' });
  });
});

describe('nickname storage', () => {
  it('returns null when nothing is saved', () => {
    expect(getNickname()).toBeNull();
  });

  it('saves a valid nickname', () => {
    saveNickname(' kopiboi ');
    expect(localStorage.getItem(NICKNAME_KEY)).toBe('kopiboi');
    expect(getNickname()).toBe('kopiboi');
  });

  it('does not save an invalid nickname', () => {
    saveNickname('x');
    expect(localStorage.getItem(NICKNAME_KEY)).toBeNull();
  });

  it('ignores a tampered stored value', () => {
    localStorage.setItem(NICKNAME_KEY, '<script>');
    expect(getNickname()).toBeNull();
  });
});

describe('getPlayerId', () => {
  it('creates a UUID once and keeps it', () => {
    const first = getPlayerId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getPlayerId()).toBe(first);
    expect(localStorage.getItem(PLAYER_ID_KEY)).toBe(first);
  });

  it('replaces a malformed stored id', () => {
    localStorage.setItem(PLAYER_ID_KEY, 'nope');
    expect(getPlayerId()).not.toBe('nope');
  });
});

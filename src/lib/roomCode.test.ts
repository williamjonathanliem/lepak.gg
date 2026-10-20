import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  cryptoRandomInt,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from './roomCode';

describe('generateRoomCode', () => {
  it('only uses the allowed alphabet, at the right length', () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });

  it('never contains confusable characters', () => {
    for (const ch of '0O1IL') expect(ROOM_CODE_ALPHABET).not.toContain(ch);
  });

  it('uses the injected random source', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
    expect(generateRoomCode((max) => max - 1)).toBe('9999');
  });

  it('can produce every character', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const ch of generateRoomCode()) seen.add(ch);
    expect(seen.size).toBe(ROOM_CODE_ALPHABET.length);
  });
});

describe('cryptoRandomInt', () => {
  it('stays in range', () => {
    for (let i = 0; i < 1000; i++) {
      const n = cryptoRandomInt(31);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(31);
    }
  });
});

describe('room code input', () => {
  it('is case-insensitive', () => {
    expect(normalizeRoomCode('kjrw')).toBe('KJRW');
    expect(isValidRoomCode('kjrw')).toBe(true);
  });

  it('ignores spaces and dashes', () => {
    expect(isValidRoomCode(' kj-rw ')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidRoomCode('KJR')).toBe(false);
    expect(isValidRoomCode('KJRWX')).toBe(false);
  });

  it('rejects confusable characters', () => {
    expect(isValidRoomCode('KJR0')).toBe(false);
    expect(isValidRoomCode('KJRL')).toBe(false);
  });
});

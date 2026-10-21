import { CalcError, evaluate, formatNumber } from './calc';
import { contrastRatio, parseHex, toHex, toHsl, wcag } from './colour';
import { addDays, daysBetween, parseDate, toIso, weekdaysBetween } from './dates';
import {
  formatBase,
  fromBase64,
  minutesLabel,
  parseBase,
  sha256,
  textStats,
  toBase64,
} from './text';
import { convert } from './units';

describe('calculator', () => {
  it('follows order of operations and brackets', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512); // right to left
    expect(evaluate('-2 ^ 2')).toBe(-4);
    expect(evaluate('10 % 4')).toBe(2);
  });

  it('handles functions, constants, factorial and implied multiplication', () => {
    expect(evaluate('sin(30)', 'deg')).toBeCloseTo(0.5);
    expect(evaluate('sin(pi/2)', 'rad')).toBeCloseTo(1);
    expect(evaluate('sqrt(16) + log(1000)')).toBe(7);
    expect(evaluate('5!')).toBe(120);
    expect(evaluate('2pi')).toBeCloseTo(2 * Math.PI);
    expect(evaluate('3(4)')).toBe(12);
    expect(evaluate('6 ÷ 3 × 2')).toBe(4);
  });

  it('rejects broken input instead of guessing', () => {
    expect(() => evaluate('2 +')).toThrow(CalcError);
    expect(() => evaluate('(2')).toThrow(CalcError);
    expect(() => evaluate('alert(1)')).toThrow(CalcError);
    expect(() => evaluate('2.5!')).toThrow(CalcError);
  });

  it('formats without floating-point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1 / 0)).toBe('∞');
  });
});

describe('unit converter', () => {
  it('converts by factor', () => {
    expect(convert(1, 'length', 'km', 'm')).toBe(1000);
    expect(convert(12, 'length', 'in', 'ft')).toBeCloseTo(1);
    expect(convert(1, 'data', 'gib', 'mb')).toBeCloseTo(1073.741824);
  });

  it('converts temperature with offsets', () => {
    expect(convert(100, 'temperature', 'c', 'f')).toBe(212);
    expect(convert(0, 'temperature', 'k', 'c')).toBeCloseTo(-273.15);
  });
});

describe('word counter', () => {
  it('counts words, sentences and paragraphs', () => {
    const s = textStats("Hello there. It's a test!\n\nSecond paragraph here");
    expect(s.words).toBe(8); // Hello there It's a test Second paragraph here
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
  });

  it('handles empty text', () => {
    expect(textStats('   ')).toMatchObject({ words: 0, sentences: 0, paragraphs: 0 });
  });

  it('labels times', () => {
    expect(minutesLabel(0.5)).toBe('30 sec');
    expect(minutesLabel(2.25)).toBe('2 min 15 sec');
  });
});

describe('encoding and bases', () => {
  it('round-trips base64 with non-English text', () => {
    expect(fromBase64(toBase64('Selamat pagi 👋'))).toBe('Selamat pagi 👋');
  });

  it('hashes with SHA-256', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('converts number bases, including big numbers', () => {
    expect(parseBase('0xff', 16)).toBe(255n);
    expect(formatBase(255n, 2)).toBe('11111111');
    expect(parseBase('1012', 2)).toBeNull();
    expect(formatBase(parseBase('123456789012345678901234567890', 10)!, 16)).toBe(
      '18EE90FF6C373E0EE4E3F0AD2',
    );
  });
});

describe('colour', () => {
  it('parses and formats hex', () => {
    expect(parseHex('#0af')).toEqual({ r: 0, g: 170, b: 255 });
    expect(toHex({ r: 255, g: 74, b: 28 })).toBe('#ff4a1c');
    expect(parseHex('nope')).toBeNull();
  });

  it('converts to HSL', () => {
    expect(toHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('computes WCAG contrast', () => {
    const r = contrastRatio(parseHex('#000')!, parseHex('#fff')!);
    expect(r).toBeCloseTo(21);
    expect(wcag(r).aaaNormal).toBe(true);
    expect(wcag(contrastRatio(parseHex('#777')!, parseHex('#fff')!)).aaNormal).toBe(false);
  });
});

describe('dates', () => {
  it('counts days and weekdays', () => {
    const a = parseDate('2026-10-19')!; // Monday
    const b = parseDate('2026-10-26')!; // next Monday
    expect(daysBetween(a, b)).toBe(7);
    expect(weekdaysBetween(a, b)).toBe(5);
    expect(daysBetween(b, a)).toBe(-7);
  });

  it('adds days and rejects impossible dates', () => {
    expect(toIso(addDays(parseDate('2026-12-30')!, 3))).toBe('2027-01-02');
    expect(parseDate('2026-02-30')).toBeNull();
  });
});

import { censorText, hasProfanity } from './profanity';

describe('profanity', () => {
  it('spots rude words', () => {
    expect(hasProfanity('what the fuck')).toBe(true);
    expect(hasProfanity('nasi lemak')).toBe(false);
  });

  it('censors only the rude part', () => {
    const out = censorText('nice shit lah');
    expect(out.startsWith('nice ')).toBe(true);
    expect(out.endsWith(' lah')).toBe(true);
    expect(out).not.toContain('shit');
  });
});

import { filterText } from './noteFilter';

describe('note filter', () => {
  it('lets normal notes through, Malay and English', () => {
    for (const ok of [
      'Add a Malay version of KataBomb pls',
      'Sudoku hard mode terlalu senang lah',
      'Class of 2026 rocks',
      'babysitting app for my cousin', // contains "babi"-ish letters, but not the word
      'Scrabble but with Manglish words',
      'dia pun dah main, sun dalam game ni best',
    ]) {
      expect(filterText(ok), ok).toBeNull();
    }
  });

  it('blocks English and local swears, including tricks', () => {
    for (const bad of [
      'this is shit',
      'kau babi',
      'b4b1 la',
      'p.u.k.i',
      'p u k i mak',
      'knn lah',
      'anak haram',
    ]) {
      expect(filterText(bad), bad).toBe('rude');
    }
  });

  it('blocks links, emails and phone numbers', () => {
    for (const bad of [
      'go to https://spam.example',
      'www.something.my',
      'free robux at scam.xyz',
      'email me ali@gmail.com',
      'call 012-345 6789',
      'whatsapp +60123456789',
    ]) {
      expect(filterText(bad), bad).toBe('contact');
    }
  });
});

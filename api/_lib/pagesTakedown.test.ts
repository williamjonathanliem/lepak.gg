import { slugFrom } from './pagesTakedown';

describe('takedown: reading the page from what was pasted', () => {
  it('takes a full link, a path or a bare slug', () => {
    expect(slugFrom('https://lepak-gg.vercel.app/n/bio-notes')).toBe('bio-notes');
    expect(slugFrom('https://lepak-gg.vercel.app/n/bio-notes/files/ch1.pdf?x=1#top')).toBe(
      'bio-notes',
    );
    expect(slugFrom('/n/bio-notes')).toBe('bio-notes');
    expect(slugFrom('  Bio-Notes  ')).toBe('bio-notes');
  });

  it('refuses anything that is not a valid slug', () => {
    expect(slugFrom('')).toBeNull();
    expect(slugFrom('a')).toBeNull();
    expect(slugFrom('../../etc')).toBeNull();
    expect(slugFrom('https://lepak-gg.vercel.app/hub')).toBeNull();
    expect(slugFrom('bad slug')).toBeNull();
  });
});

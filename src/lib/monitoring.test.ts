import { cleanUrl } from './monitoring';

describe('cleanUrl', () => {
  it('drops the query and the hash (Pages edit keys live there)', () => {
    expect(cleanUrl('https://lepak.gg/n/bio/edit#key=secret')).toBe('https://lepak.gg/n/bio/edit');
    expect(cleanUrl('https://lepak.gg/cite?url=x')).toBe('https://lepak.gg/cite');
    expect(cleanUrl('/hub')).toBe('/hub');
  });
});

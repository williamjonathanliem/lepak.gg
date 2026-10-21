import { LOCAL_KEEP_MS, sweepStorage } from './storage';

describe('sweepStorage', () => {
  beforeEach(() => localStorage.clear());

  it('clears lepak keys unused for 30 days and keeps the rest', () => {
    const now = 1_000_000_000_000;
    localStorage.setItem('lepak.old', 'x');
    localStorage.setItem('lepak.fresh', 'y');
    localStorage.setItem('lepak.new', 'z'); // no date yet
    localStorage.setItem('other.site', 'keep');
    localStorage.setItem(
      'lepak.touched',
      JSON.stringify({ 'lepak.old': now - LOCAL_KEEP_MS - 1, 'lepak.fresh': now - 1000 }),
    );
    expect(sweepStorage(now)).toEqual(['lepak.old']);
    expect(localStorage.getItem('lepak.old')).toBeNull();
    expect(localStorage.getItem('lepak.fresh')).toBe('y');
    expect(localStorage.getItem('lepak.new')).toBe('z');
    expect(localStorage.getItem('other.site')).toBe('keep');
    const stamps = JSON.parse(localStorage.getItem('lepak.touched')!) as Record<string, number>;
    expect(stamps['lepak.new']).toBe(now);
  });
});

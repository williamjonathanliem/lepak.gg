import { linkQuality } from '../../../lib/rtc/link';
import { MODES, bitrateFor } from './modes';

describe('bitrateFor', () => {
  it('gives the full cap to one or two viewers, then shares it out', () => {
    expect(bitrateFor('movie', 1)).toBe(MODES.movie.maxBitrate);
    expect(bitrateFor('movie', 2)).toBe(MODES.movie.maxBitrate);
    expect(bitrateFor('movie', 4)).toBe(MODES.movie.maxBitrate / 2);
    expect(bitrateFor('movie', 6)).toBe(MODES.movie.maxBitrate / 3);
  });
});

describe('linkQuality', () => {
  const base = { rttMs: 40, relay: false, fps: 30, loss: 0 };
  it('reads the connection', () => {
    expect(linkQuality(null)).toBe('unknown');
    expect(linkQuality({ ...base, rttMs: null })).toBe('unknown');
    expect(linkQuality(base)).toBe('good');
    expect(linkQuality({ ...base, rttMs: 200 })).toBe('ok');
    expect(linkQuality({ ...base, loss: 0.1 })).toBe('slow');
    expect(linkQuality({ ...base, fps: 4 })).toBe('slow');
    expect(linkQuality({ ...base, relay: true })).toBe('relay');
  });
});

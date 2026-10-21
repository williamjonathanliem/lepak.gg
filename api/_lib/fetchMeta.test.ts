import { allowRequest, fromOurSite } from './fetchMeta';

describe('/api/meta guards', () => {
  it('only answers our own pages', () => {
    const url = 'https://lepak-gg.vercel.app/api/meta?url=x';
    expect(fromOurSite(new Request(url, { headers: { 'sec-fetch-site': 'same-origin' } }))).toBe(
      true,
    );
    expect(fromOurSite(new Request(url, { headers: { 'sec-fetch-site': 'cross-site' } }))).toBe(
      false,
    );
    expect(
      fromOurSite(new Request(url, { headers: { origin: 'https://lepak-gg.vercel.app' } })),
    ).toBe(true);
    expect(fromOurSite(new Request(url, { headers: { origin: 'https://evil.example' } }))).toBe(
      false,
    );
    expect(fromOurSite(new Request(url))).toBe(false);
  });

  it('rate limits each IP per minute', () => {
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) expect(allowRequest('1.2.3.4', t)).toBe(true);
    expect(allowRequest('1.2.3.4', t)).toBe(false);
    expect(allowRequest('5.6.7.8', t)).toBe(true);
    expect(allowRequest('1.2.3.4', t + 61_000)).toBe(true);
  });
});

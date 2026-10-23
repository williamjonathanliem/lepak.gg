import { allowRequest, fromOurSite, isPrivateIp } from './fetchMeta';

describe('private address check', () => {
  it('blocks private IPv4, including inside IPv6', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '169.254.169.254',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1', // how a URL writes [::ffff:127.0.0.1]
      '::ffff:a9fe:a9fe', // 169.254.169.254
      '64:ff9b::a00:1', // NAT64 of 10.0.0.1
      '2002:c0a8:0101::1', // 6to4 of 192.168.1.1
      '::1',
      'fd00::1',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('lets public addresses through', () => {
    for (const ip of ['8.8.8.8', '::ffff:808:808', '2606:4700::1111', '2002:808:808::1']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

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

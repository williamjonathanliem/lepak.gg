// Fetches a public web page and reads its citation details. Used by /api/meta (Vercel) and
// by the dev server (vite.config.ts), so Cite can turn any link into a reference.
//
// Safety: only http(s) on normal ports, never private/internal addresses (checked again on
// every redirect), 8 second timeout, at most 1.5 MB read, HTML only.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parseMeta, type PageMeta } from '../../src/apps/cite/logic/meta';

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

export class MetaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isPrivateIp(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe80')
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new MetaError('Only web links', 400);
  if (url.port && url.port !== '80' && url.port !== '443') throw new MetaError('Unusual port', 400);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new MetaError('Private address', 400);
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new MetaError('Private address', 400);
  }
}

export async function fetchPageMeta(raw: string): Promise<PageMeta> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MetaError('Not a link', 400);
  }

  for (let hop = 0; ; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'LepakCite/1.0 (+https://lepak-gg.vercel.app/cite)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop >= MAX_REDIRECTS) throw new MetaError('Too many redirects', 502);
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new MetaError(`Page answered ${res.status}`, 502);
    if (!(res.headers.get('content-type') ?? '').includes('html')) {
      throw new MetaError('Not a web page', 415);
    }
    // Read at most MAX_BYTES; citation tags live in <head>, near the top.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    void reader.cancel().catch(() => undefined);
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    return parseMeta(html, url.toString());
  }
}

/** Shared request handler: GET /api/meta?url=... -> PageMeta as JSON. */
export async function handleMetaRequest(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return Response.json({ error: 'Missing url' }, { status: 400 });
  try {
    const meta = await fetchPageMeta(target);
    return Response.json(meta, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch (e) {
    const status = e instanceof MetaError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status });
  }
}

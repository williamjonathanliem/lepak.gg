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

// ---------- abuse guards ----------
//
// /api/meta fetches pages for Cite only. Two cheap checks stop other sites and scripts from
// using it as a free page fetcher:
// 1. The request must come from our own pages (browsers send Sec-Fetch-Site / Origin).
// 2. Each IP gets RATE_LIMIT lookups per minute. With Upstash Redis set up (env below) the
//    count is shared by every server instance; without it, each instance counts on its own
//    (rougher, but still something, and it's what runs in local dev).
//
//    UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (or KV_REST_API_URL + KV_REST_API_TOKEN,
//    the names the Vercel Upstash integration uses). Server-only: never VITE_.

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_URL_LENGTH = 2000;
const hits = new Map<string, { count: number; resetAt: number }>();

/** True if this IP may make another lookup now. */
export function allowRequest(ip: string, now = Date.now(), limit = RATE_LIMIT): boolean {
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    if (hits.size > 5000) hits.clear(); // don't grow forever
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

type Limiter = { limit(id: string): Promise<{ success: boolean }> };
let shared: Promise<Limiter | null> | null = null;

/** The Upstash limiter, or null when it isn't configured. Created once per instance. */
function sharedLimiter(): Promise<Limiter | null> {
  shared ??= (async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) return null;
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ]);
    return new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(RATE_LIMIT, '1 m'),
      prefix: 'lepak:meta',
    });
  })();
  return shared;
}

/** Shared limit when Upstash is set up, otherwise this instance's own count. */
async function underLimit(ip: string): Promise<boolean> {
  const limiter = await sharedLimiter();
  if (!limiter) return allowRequest(ip);
  try {
    return (await limiter.limit(ip)).success;
  } catch {
    return allowRequest(ip); // Redis down: fall back rather than block everyone
  }
}

/** True if the request was made by a page on our own site. */
export function fromOurSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'same-site';
  const host = new URL(request.url).host;
  const from = request.headers.get('origin') ?? request.headers.get('referer');
  if (!from) return false;
  try {
    return new URL(from).host === host;
  } catch {
    return false;
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/** Shared request handler: GET /api/meta?url=... -> PageMeta as JSON. */
export async function handleMetaRequest(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return Response.json({ error: 'Missing url' }, { status: 400 });
  if (target.length > MAX_URL_LENGTH)
    return Response.json({ error: 'Link too long' }, { status: 414 });
  if (!fromOurSite(request)) return Response.json({ error: 'Not allowed' }, { status: 403 });
  if (!(await underLimit(clientIp(request)))) {
    return Response.json(
      { error: 'Too many lookups. Wait a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }
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

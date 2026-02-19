import type { VercelRequest, VercelResponse } from '@vercel/node';

type LiveStatus = 'operational' | 'degraded' | 'unknown';

function firstHeader(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function inferStatusFromText(text: string): LiveStatus | null {
  const lower = text.toLowerCase();

  if (lower.includes('all systems operational')) return 'operational';

  if (
    lower.includes('major outage')
    || lower.includes('partial outage')
    || lower.includes('degraded performance')
    || lower.includes('"status":"degraded"')
    || lower.includes('"status":"down"')
    || lower.includes('"status":"outage"')
  ) {
    return 'degraded';
  }

  if (lower.includes('operational')) return 'operational';

  return null;
}

function inferStatusFromJson(payload: unknown): LiveStatus | null {
  const raw = JSON.stringify(payload);
  return inferStatusFromText(raw);
}

async function probeOpenStatus(): Promise<LiveStatus | null> {
  const urls = [
    'https://openagreements.openstatus.dev/api/v1/status',
    'https://openagreements.openstatus.dev/api/v1/public/status',
    'https://openagreements.openstatus.dev/',
  ];

  for (const url of urls) {
    try {
      const requestInit: RequestInit = {};
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        requestInit.signal = AbortSignal.timeout(4000);
      }

      const res = await fetch(url, requestInit);
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        const parsed = inferStatusFromJson(json);
        if (parsed) return parsed;
        continue;
      }

      const text = await res.text();
      const parsed = inferStatusFromText(text);
      if (parsed) return parsed;
    } catch {
      // Try the next endpoint.
    }
  }

  return null;
}

async function probeMcp(baseUrl: string): Promise<LiveStatus> {
  try {
    const requestInit: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      requestInit.signal = AbortSignal.timeout(4000);
    }

    const res = await fetch(`${baseUrl}/api/mcp`, requestInit);
    if (res.ok) return 'operational';
    if (res.status === 404) return 'unknown';
    return 'degraded';
  } catch {
    return 'unknown';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Only GET requests are accepted' });
    return;
  }

  const proto = firstHeader(req.headers['x-forwarded-proto'], 'https');
  const host = firstHeader(req.headers['x-forwarded-host'], firstHeader(req.headers.host, 'openagreements.ai'));
  const baseUrl = `${proto}://${host}`;
  const checkedAt = new Date().toISOString();

  const openStatus = await probeOpenStatus();
  if (openStatus) {
    res.status(200).json({ status: openStatus, source: 'openstatus', checkedAt });
    return;
  }

  const mcpStatus = await probeMcp(baseUrl);
  res.status(200).json({ status: mcpStatus, source: 'mcp', checkedAt });
}

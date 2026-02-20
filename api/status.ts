import type { HttpRequest, HttpResponse } from './_http-types.js';

const DEFAULT_OPENSTATUS_SLUG = 'openagreements';
const DEFAULT_OPENSTATUS_PUBLIC_API_BASE = 'https://api.openstatus.dev/public/status';
const BADGE_LABEL = 'MCP server status';

type NormalizedStatus = 'operational' | 'degraded' | 'maintenance' | 'unverified';

type StatusRender = {
  status: NormalizedStatus;
  message: string;
  color: string;
  rawStatus: string | null;
};

function getFirstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeOpenStatus(rawValue: unknown): StatusRender {
  const rawStatus = typeof rawValue === 'string' ? rawValue : null;
  const status = rawStatus?.toLowerCase();

  if (status === 'operational') {
    return { status: 'operational', message: 'operational', color: '4c1', rawStatus };
  }

  if (
    status === 'degraded'
    || status === 'partial_outage'
    || status === 'major_outage'
    || status === 'outage'
    || status === 'incident'
  ) {
    return { status: 'degraded', message: 'degraded', color: 'e05d44', rawStatus };
  }

  if (status === 'maintenance') {
    return { status: 'maintenance', message: 'maintenance', color: 'dfb317', rawStatus };
  }

  return { status: 'unverified', message: 'unverified', color: '9f9f9f', rawStatus };
}

async function fetchOpenStatusStatus(slug: string): Promise<StatusRender> {
  const baseUrl = process.env['OPENSTATUS_PUBLIC_API_BASE'] ?? DEFAULT_OPENSTATUS_PUBLIC_API_BASE;
  const endpoint = `${baseUrl}/${encodeURIComponent(slug)}`;
  const request: RequestInit = { method: 'GET' };

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    request.signal = AbortSignal.timeout(5_000);
  }

  const response = await fetch(endpoint, request);
  if (!response.ok) {
    throw new Error(`OpenStatus upstream returned ${response.status}`);
  }

  const payload = await response.json() as { status?: unknown };
  return normalizeOpenStatus(payload.status);
}

function statusResponseBody(render: StatusRender, checkedAt: string) {
  return {
    status: render.status,
    source: 'openstatus',
    raw_status: render.rawStatus,
    checked_at: checkedAt,
  };
}

function shieldsResponseBody(render: StatusRender) {
  return {
    schemaVersion: 1,
    label: BADGE_LABEL,
    message: render.message,
    color: render.color,
  };
}

export default async function handler(req: HttpRequest, res: HttpResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and HEAD requests are accepted',
      },
    });
  }

  const format = getFirstQueryValue(req.query['format']);
  const slug = process.env['OPENSTATUS_SLUG'] ?? DEFAULT_OPENSTATUS_SLUG;
  const checkedAt = new Date().toISOString();
  let render: StatusRender = {
    status: 'unverified',
    message: 'unverified',
    color: '9f9f9f',
    rawStatus: null,
  };

  try {
    render = await fetchOpenStatusStatus(slug);
  } catch {
    // Keep unverified fallback when OpenStatus is unavailable.
  }

  if (req.method === 'HEAD') return res.status(200).end();

  if (format === 'shields') {
    return res.status(200).json(shieldsResponseBody(render));
  }

  return res.status(200).json(statusResponseBody(render, checkedAt));
}

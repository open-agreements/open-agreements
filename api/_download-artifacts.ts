import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const DOWNLOAD_ID_SECRET =
  process.env['DOWNLOAD_ID_SECRET'] ??
  process.env['DOWNLOAD_TOKEN_SECRET'] ??
  process.env['VERCEL_DEPLOYMENT_ID'] ??
  'open-agreements-dev-fallback';

const DOWNLOAD_STORE_PREFIX = process.env['DOWNLOAD_STORE_PREFIX'] ?? 'oa:download:';

export const DOWNLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

function hmacSignDownloadId(rawId: string): string {
  return createHmac('sha256', DOWNLOAD_ID_SECRET).update(rawId).digest('base64url');
}

function encodeSignedDownloadId(rawId: string): string {
  return `${rawId}.${hmacSignDownloadId(rawId)}`;
}

type DownloadIdParseResult =
  | { ok: true; rawId: string }
  | { ok: false; code: 'DOWNLOAD_ID_MALFORMED' | 'DOWNLOAD_SIGNATURE_INVALID' };

function decodeSignedDownloadId(downloadId: string): DownloadIdParseResult {
  const firstDot = downloadId.indexOf('.');
  const lastDot = downloadId.lastIndexOf('.');
  if (firstDot <= 0 || firstDot !== lastDot) {
    return { ok: false, code: 'DOWNLOAD_ID_MALFORMED' };
  }

  const rawId = downloadId.slice(0, firstDot);
  const sig = downloadId.slice(firstDot + 1);

  if (!/^[a-f0-9]{32}$/.test(rawId)) {
    return { ok: false, code: 'DOWNLOAD_ID_MALFORMED' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(sig)) {
    return { ok: false, code: 'DOWNLOAD_ID_MALFORMED' };
  }

  const expected = hmacSignDownloadId(rawId);
  if (sig.length !== expected.length) {
    return { ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' };
  }
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' };
    }
  } catch {
    return { ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' };
  }

  return { ok: true, rawId };
}

export interface DownloadArtifact {
  template: string;
  values: Record<string, unknown>;
  created_at_ms: number;
  expires_at_ms: number;
  variant?: 'filled' | 'redline';
  redline_base?: 'source' | 'clean';
}

function isDownloadArtifact(value: unknown): value is DownloadArtifact {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const artifact = value as Record<string, unknown>;
  return (
    typeof artifact['template'] === 'string'
    && typeof artifact['values'] === 'object'
    && artifact['values'] !== null
    && typeof artifact['created_at_ms'] === 'number'
    && typeof artifact['expires_at_ms'] === 'number'
  );
}

export interface DownloadArtifactStore {
  set(rawId: string, artifact: DownloadArtifact): Promise<void>;
  get(rawId: string): Promise<DownloadArtifact | null>;
  delete(rawId: string): Promise<void>;
}

class InMemoryDownloadArtifactStore implements DownloadArtifactStore {
  private readonly map = new Map<string, DownloadArtifact>();

  async set(rawId: string, artifact: DownloadArtifact): Promise<void> {
    this.map.set(rawId, artifact);
  }

  async get(rawId: string): Promise<DownloadArtifact | null> {
    return this.map.get(rawId) ?? null;
  }

  async delete(rawId: string): Promise<void> {
    this.map.delete(rawId);
  }
}

class UpstashRestDownloadArtifactStore implements DownloadArtifactStore {
  constructor(
    private readonly restUrl: string,
    private readonly restToken: string,
    private readonly keyPrefix: string,
  ) {}

  private key(rawId: string): string {
    return `${this.keyPrefix}${rawId}`;
  }

  private async command<T>(argv: string[]): Promise<T | null> {
    const response = await fetch(this.restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(argv),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Upstash command failed: HTTP ${response.status}`);
    }

    const payload = await response.json() as { result?: T | null; error?: string };
    if (payload.error) {
      throw new Error(`Upstash command failed: ${payload.error}`);
    }
    return payload.result ?? null;
  }

  async set(rawId: string, artifact: DownloadArtifact): Promise<void> {
    const ttlMs = Math.max(1, artifact.expires_at_ms - Date.now());
    await this.command<string>([
      'SET',
      this.key(rawId),
      JSON.stringify(artifact),
      'PX',
      String(ttlMs),
    ]);
  }

  async get(rawId: string): Promise<DownloadArtifact | null> {
    const encoded = await this.command<string>(['GET', this.key(rawId)]);
    if (typeof encoded !== 'string') {
      return null;
    }

    try {
      const parsed = JSON.parse(encoded) as unknown;
      return isDownloadArtifact(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async delete(rawId: string): Promise<void> {
    await this.command<number>(['DEL', this.key(rawId)]);
  }
}

let downloadArtifactStore: DownloadArtifactStore | null = null;

function configuredUpstashStore(): DownloadArtifactStore | null {
  const restUrl = process.env['KV_REST_API_URL'] ?? process.env['UPSTASH_REDIS_REST_URL'];
  const restToken = process.env['KV_REST_API_TOKEN'] ?? process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!restUrl || !restToken) {
    return null;
  }
  return new UpstashRestDownloadArtifactStore(restUrl, restToken, DOWNLOAD_STORE_PREFIX);
}

function getDownloadArtifactStore(): DownloadArtifactStore {
  if (downloadArtifactStore) {
    return downloadArtifactStore;
  }

  // Keep tests deterministic and offline even if local env has KV vars.
  if (process.env['NODE_ENV'] === 'test') {
    downloadArtifactStore = new InMemoryDownloadArtifactStore();
    return downloadArtifactStore;
  }

  downloadArtifactStore = configuredUpstashStore() ?? new InMemoryDownloadArtifactStore();
  return downloadArtifactStore;
}

export interface CreatedDownloadArtifact {
  download_id: string;
  expires_at: string;
  expires_at_ms: number;
}

export async function createDownloadArtifact(
  template: string,
  values: Record<string, unknown>,
  opts?: { ttl_ms?: number; now_ms?: number; variant?: 'filled' | 'redline'; redline_base?: 'source' | 'clean' },
): Promise<CreatedDownloadArtifact> {
  const nowMs = opts?.now_ms ?? Date.now();
  const ttlMs = opts?.ttl_ms ?? DOWNLOAD_TTL_MS;
  const rawId = randomUUID().replace(/-/g, '');
  const expiresAtMs = nowMs + ttlMs;

  const artifact: DownloadArtifact = {
    template,
    values,
    created_at_ms: nowMs,
    expires_at_ms: expiresAtMs,
    ...(opts?.variant && { variant: opts.variant }),
    ...(opts?.redline_base && { redline_base: opts.redline_base }),
  };

  await getDownloadArtifactStore().set(rawId, artifact);

  return {
    download_id: encodeSignedDownloadId(rawId),
    expires_at_ms: expiresAtMs,
    expires_at: new Date(expiresAtMs).toISOString(),
  };
}

export type ResolveDownloadArtifactErrorCode =
  | 'DOWNLOAD_ID_MALFORMED'
  | 'DOWNLOAD_SIGNATURE_INVALID'
  | 'DOWNLOAD_EXPIRED'
  | 'DOWNLOAD_NOT_FOUND';

export type ResolveDownloadArtifactResult =
  | { ok: true; artifact: DownloadArtifact }
  | { ok: false; code: ResolveDownloadArtifactErrorCode };

export async function resolveDownloadArtifact(downloadId: string): Promise<ResolveDownloadArtifactResult> {
  const parsed = decodeSignedDownloadId(downloadId);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code };
  }

  const store = getDownloadArtifactStore();
  const artifact = await store.get(parsed.rawId);
  if (!artifact) {
    return { ok: false, code: 'DOWNLOAD_NOT_FOUND' };
  }

  if (Date.now() > artifact.expires_at_ms) {
    try {
      await store.delete(parsed.rawId);
    } catch {
      // Best-effort cleanup; expiry check already failed.
    }
    return { ok: false, code: 'DOWNLOAD_EXPIRED' };
  }

  return { ok: true, artifact };
}

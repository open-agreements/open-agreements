import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const DOWNLOAD_ID_SECRET =
  process.env['DOWNLOAD_ID_SECRET'] ??
  process.env['DOWNLOAD_TOKEN_SECRET'] ??
  process.env['VERCEL_DEPLOYMENT_ID'] ??
  'open-agreements-dev-fallback';

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

export type DownloadStorageMode = 'upstash' | 'memory';

/**
 * Base class for situations where the download artifact store cannot serve a
 * request. Subclassed into configuration vs runtime so HTTP/MCP consumers can
 * map them to the right status (500 vs 503).
 */
export class DownloadStoreUnavailableError extends Error {
  readonly cause_type: 'configuration' | 'runtime';
  constructor(message: string, cause_type: 'configuration' | 'runtime') {
    super(message);
    this.name = 'DownloadStoreUnavailableError';
    this.cause_type = cause_type;
  }
}

/** Durable storage required but not configured (or escape hatch rejected). */
export class DownloadStoreConfigurationError extends DownloadStoreUnavailableError {
  constructor(message: string) {
    super(message, 'configuration');
    this.name = 'DownloadStoreConfigurationError';
  }
}

/** Durable storage configured but unreachable / returned a transport error. */
export class DownloadStoreRuntimeError extends DownloadStoreUnavailableError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message, 'runtime');
    this.name = 'DownloadStoreRuntimeError';
    if (opts?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
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
    const op = argv[0];
    let response: Response;
    try {
      response = await fetch(this.restUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(argv),
        cache: 'no-store',
      });
    } catch (cause) {
      console.error(JSON.stringify({
        event: 'download_store_command',
        op,
        reason: 'fetch_failed',
      }));
      throw new DownloadStoreRuntimeError('Upstash command failed: fetch error', { cause });
    }

    if (!response.ok) {
      console.error(JSON.stringify({
        event: 'download_store_command',
        op,
        status: response.status,
      }));
      throw new DownloadStoreRuntimeError(`Upstash command failed: HTTP ${response.status}`);
    }

    let payload: { result?: T | null; error?: string };
    try {
      payload = await response.json() as { result?: T | null; error?: string };
    } catch (cause) {
      console.error(JSON.stringify({
        event: 'download_store_command',
        op,
        reason: 'json_parse_failed',
      }));
      throw new DownloadStoreRuntimeError('Upstash command failed: invalid JSON response', { cause });
    }
    if (payload.error) {
      console.error(JSON.stringify({
        event: 'download_store_command',
        op,
        upstash_error: payload.error,
      }));
      throw new DownloadStoreRuntimeError(`Upstash command failed: ${payload.error}`);
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

export interface DownloadStoreInitResult {
  store: DownloadArtifactStore;
  mode: DownloadStorageMode;
}

export interface InitDownloadArtifactStoreDeps {
  upstashFactory?: (url: string, token: string, prefix: string) => DownloadArtifactStore;
  /** Override the logger; defaults to `console`. Tests can pass a quiet stub. */
  log?: Pick<Console, 'log' | 'warn' | 'error'>;
}

function inMemoryAllowed(env: NodeJS.ProcessEnv): boolean {
  if (env['NODE_ENV'] === 'test') return true;
  if (env['NODE_ENV'] === 'development') return true;
  if (env['VERCEL_ENV'] === 'development') return true;
  return false;
}

function isProductionLikeServerless(env: NodeJS.ProcessEnv): boolean {
  return env['VERCEL_ENV'] === 'production' || env['VERCEL_ENV'] === 'preview';
}

/**
 * Pure initializer: chooses a storage backend based on env without touching
 * module-scoped state. Returns the store and the mode it was initialized in.
 *
 * Throws DownloadStoreConfigurationError when durable storage is required but
 * unconfigured, or when the in-memory escape hatch is rejected (preview/prod).
 *
 * Policy:
 * - Upstash KV vars present → durable mode, regardless of environment.
 * - No durable + env is "known safe" (NODE_ENV=test|development or
 *   VERCEL_ENV=development) → in-memory.
 * - No durable + env unknown/production → throw.
 * - DOWNLOAD_ALLOW_IN_MEMORY=1 honored only when VERCEL_ENV is not
 *   production|preview (still emits a structured warn).
 */
export function initDownloadArtifactStore(
  env: NodeJS.ProcessEnv = process.env,
  deps: InitDownloadArtifactStoreDeps = {},
): DownloadStoreInitResult {
  const log = deps.log ?? console;
  const isTest = env['NODE_ENV'] === 'test';

  // Tests stay deterministic and offline regardless of local env.
  if (isTest) {
    return { store: new InMemoryDownloadArtifactStore(), mode: 'memory' };
  }

  const restUrl = env['KV_REST_API_URL'] ?? env['UPSTASH_REDIS_REST_URL'];
  const restToken = env['KV_REST_API_TOKEN'] ?? env['UPSTASH_REDIS_REST_TOKEN'];
  const keyPrefix = env['DOWNLOAD_STORE_PREFIX'] ?? 'oa:download:';
  const allowInMemoryFlag = env['DOWNLOAD_ALLOW_IN_MEMORY'] === '1';
  const productionLike = isProductionLikeServerless(env);
  const memoryAllowed = inMemoryAllowed(env);

  if (restUrl && restToken) {
    const factory = deps.upstashFactory
      ?? ((u, t, p) => new UpstashRestDownloadArtifactStore(u, t, p));
    const store = factory(restUrl, restToken, keyPrefix);
    log.log(JSON.stringify({
      event: 'download_store_init',
      mode: 'upstash',
      durable_required: !memoryAllowed,
      allow_in_memory_honored: false,
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
    }));
    return { store, mode: 'upstash' };
  }

  if (allowInMemoryFlag && productionLike) {
    log.error(JSON.stringify({
      event: 'download_store_init',
      mode: 'error',
      reason: 'allow_in_memory_rejected_in_production',
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
    }));
    throw new DownloadStoreConfigurationError(
      'DOWNLOAD_ALLOW_IN_MEMORY=1 is rejected when VERCEL_ENV is production or preview. '
      + 'Configure KV_REST_API_URL and KV_REST_API_TOKEN '
      + '(or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) instead.',
    );
  }

  if (!memoryAllowed && !allowInMemoryFlag) {
    log.error(JSON.stringify({
      event: 'download_store_init',
      mode: 'error',
      reason: 'durable_store_required',
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
    }));
    throw new DownloadStoreConfigurationError(
      'Durable download artifact store is required outside known-safe contexts '
      + '(NODE_ENV=test|development or VERCEL_ENV=development). '
      + 'Set KV_REST_API_URL and KV_REST_API_TOKEN '
      + '(or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN).',
    );
  }

  const store = new InMemoryDownloadArtifactStore();
  if (allowInMemoryFlag) {
    log.warn(JSON.stringify({
      event: 'download_store_init',
      mode: 'memory',
      durable_required: !memoryAllowed,
      allow_in_memory_honored: true,
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
      warning: 'In-memory download store is not safe across serverless instances.',
    }));
  } else {
    log.log(JSON.stringify({
      event: 'download_store_init',
      mode: 'memory',
      durable_required: false,
      allow_in_memory_honored: false,
      node_env: env['NODE_ENV'] ?? null,
      vercel_env: env['VERCEL_ENV'] ?? null,
    }));
  }
  return { store, mode: 'memory' };
}

let cachedInit: DownloadStoreInitResult | null = null;

function getDownloadArtifactStore(): DownloadArtifactStore {
  if (cachedInit) return cachedInit.store;
  cachedInit = initDownloadArtifactStore();
  return cachedInit.store;
}

export function getDownloadStorageMode(): DownloadStorageMode | null {
  return cachedInit?.mode ?? null;
}

/**
 * Test-only: clears the cached singleton so a subsequent call rebuilds against
 * a different env. Used by endpoint tests that need to install a stub init.
 */
export function _resetDownloadArtifactStoreCacheForTests(
  next?: DownloadStoreInitResult,
): void {
  cachedInit = next ?? null;
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

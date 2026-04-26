/**
 * Unit tests for signed opaque download IDs (sign/verify/expiry).
 * These are pure helper tests — no endpoint mocking needed.
 */

import { describe, expect } from 'vitest';
import { itAllure, allureStep, allureJsonAttachment } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

const {
  createDownloadArtifact,
  resolveDownloadArtifact,
  initDownloadArtifactStore,
  DownloadStoreConfigurationError,
  DownloadStoreUnavailableError,
} = await import('../api/_download-artifacts.js');

describe('Download IDs — sign / verify / expiry', () => {
  const TEMPLATE = 'common-paper-mutual-nda';
  const VALUES = { company_name: 'Acme Corp', counterparty_name: 'Globex Inc' };

  it.openspec('OA-DST-030')('round-trips a valid signed download_id', async () => {
    const created = await createDownloadArtifact(TEMPLATE, VALUES);
    await allureStep('Create download artifact', async () => {
      expect(created.download_id).toBeTypeOf('string');
      expect(created.download_id).toContain('.');
    });

    const resolved = await allureStep('Resolve download_id', async () => {
      return resolveDownloadArtifact(created.download_id);
    });

    await allureJsonAttachment('download-id-roundtrip.json', {
      download_id: created.download_id.slice(0, 40) + '...',
      resolved,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.artifact.template).toBe(TEMPLATE);
      expect(resolved.artifact.values).toEqual(VALUES);
      expect(resolved.artifact.expires_at_ms).toBeGreaterThan(Date.now());
    }
  });

  it.openspec('OA-DST-030')('rejects a tampered signature', async () => {
    const created = await createDownloadArtifact(TEMPLATE, VALUES);
    const tampered = created.download_id.slice(0, -1)
      + (created.download_id.endsWith('A') ? 'B' : 'A');

    const resolved = await resolveDownloadArtifact(tampered);
    expect(resolved).toEqual({ ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' });
  });

  it.openspec('OA-DST-030')('rejects malformed download_id values', async () => {
    await expect(resolveDownloadArtifact('')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
    await expect(resolveDownloadArtifact('no-dot-here')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
    await expect(resolveDownloadArtifact('.leading-dot')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
    await expect(resolveDownloadArtifact('nothex.not-base64')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
  });

  it.openspec('OA-DST-031')('rejects an expired download_id', async () => {
    const created = await createDownloadArtifact(TEMPLATE, VALUES, { ttl_ms: -1 });
    const resolved = await resolveDownloadArtifact(created.download_id);
    expect(resolved).toEqual({ ok: false, code: 'DOWNLOAD_EXPIRED' });
  });

  it.openspec('OA-DST-030')('preserves empty values object', async () => {
    const created = await createDownloadArtifact(TEMPLATE, {});
    const resolved = await resolveDownloadArtifact(created.download_id);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.artifact.values).toEqual({});
    }
  });

  it.openspec('OA-DST-031')('keeps download_id length stable as values grow', async () => {
    const manyValues: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
      manyValues[`field_${i}`] = `value_${i}_with_some_content`;
    }
    const created = await createDownloadArtifact(TEMPLATE, manyValues);

    await allureJsonAttachment('download-id-stats.json', {
      fieldCount: 20,
      downloadIdLength: created.download_id.length,
      withinUrlLimit: created.download_id.length < 256,
    });

    expect(created.download_id.length).toBeLessThan(256);
    const resolved = await resolveDownloadArtifact(created.download_id);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(Object.keys(resolved.artifact.values)).toHaveLength(20);
    }
  });
});

describe('Download artifact store policy — initDownloadArtifactStore', () => {
  // Quiet log stub so tests don't pollute stdout.
  function makeLog() {
    const calls: { level: 'log' | 'warn' | 'error'; payload: unknown }[] = [];
    return {
      log: (...args: unknown[]) => calls.push({ level: 'log', payload: args[0] }),
      warn: (...args: unknown[]) => calls.push({ level: 'warn', payload: args[0] }),
      error: (...args: unknown[]) => calls.push({ level: 'error', payload: args[0] }),
      calls,
    };
  }

  // The pure initializer must not look at the real process.env — pass everything
  // explicitly so test order/parallelism cannot leak.
  function envOnly(extra: Record<string, string | undefined>): NodeJS.ProcessEnv {
    return extra as NodeJS.ProcessEnv;
  }

  it.openspec('OA-DST-036')('throws DownloadStoreConfigurationError in production without KV', () => {
    const log = makeLog();
    const env = envOnly({ NODE_ENV: 'production', VERCEL_ENV: 'production' });
    expect(() => initDownloadArtifactStore(env, { log })).toThrow(DownloadStoreConfigurationError);
    const errorLog = log.calls.find((c) => c.level === 'error');
    expect(errorLog).toBeDefined();
    if (errorLog) {
      const parsed = JSON.parse(errorLog.payload as string);
      expect(parsed).toMatchObject({
        event: 'download_store_init',
        mode: 'error',
        reason: 'durable_store_required',
        vercel_env: 'production',
      });
    }
  });

  it.openspec('OA-DST-036')('throws when VERCEL_ENV=preview without KV (preview is multi-instance)', () => {
    const log = makeLog();
    const env = envOnly({ VERCEL_ENV: 'preview' });
    expect(() => initDownloadArtifactStore(env, { log })).toThrow(DownloadStoreConfigurationError);
  });

  it.openspec('OA-DST-036')('rejects DOWNLOAD_ALLOW_IN_MEMORY=1 in production/preview', () => {
    const log = makeLog();
    const env = envOnly({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      DOWNLOAD_ALLOW_IN_MEMORY: '1',
    });
    expect(() => initDownloadArtifactStore(env, { log })).toThrow(DownloadStoreUnavailableError);
    const errorLog = log.calls.find((c) => c.level === 'error');
    expect(errorLog).toBeDefined();
    if (errorLog) {
      const parsed = JSON.parse(errorLog.payload as string);
      expect(parsed).toMatchObject({
        event: 'download_store_init',
        mode: 'error',
        reason: 'allow_in_memory_rejected_in_production',
      });
    }
  });

  it.openspec('OA-DST-036')('allows in-memory when VERCEL_ENV=development without KV', () => {
    const log = makeLog();
    const env = envOnly({ VERCEL_ENV: 'development' });
    const result = initDownloadArtifactStore(env, { log });
    expect(result.mode).toBe('memory');
  });

  it.openspec('OA-DST-036')('allows in-memory when NODE_ENV=development without KV', () => {
    const log = makeLog();
    const env = envOnly({ NODE_ENV: 'development' });
    const result = initDownloadArtifactStore(env, { log });
    expect(result.mode).toBe('memory');
  });

  it.openspec('OA-DST-036')('uses upstash when KV vars are present, regardless of NODE_ENV (non-test)', () => {
    const log = makeLog();
    const env = envOnly({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      KV_REST_API_URL: 'https://example.upstash.io',
      KV_REST_API_TOKEN: 'tkn',
    });
    let factoryCalled = false;
    const result = initDownloadArtifactStore(env, {
      log,
      upstashFactory: (url, token, prefix) => {
        factoryCalled = true;
        expect(url).toBe('https://example.upstash.io');
        expect(token).toBe('tkn');
        expect(prefix).toBe('oa:download:');
        return {
          set: async () => undefined,
          get: async () => null,
          delete: async () => undefined,
        };
      },
    });
    expect(factoryCalled).toBe(true);
    expect(result.mode).toBe('upstash');
  });

  it.openspec('OA-DST-037')('cold-start log includes diagnostic fields for upstash mode', () => {
    const log = makeLog();
    const env = envOnly({
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      KV_REST_API_URL: 'https://example.upstash.io',
      KV_REST_API_TOKEN: 'tkn',
    });
    initDownloadArtifactStore(env, {
      log,
      upstashFactory: () => ({
        set: async () => undefined,
        get: async () => null,
        delete: async () => undefined,
      }),
    });
    const initLog = log.calls.find((c) => c.level === 'log');
    expect(initLog).toBeDefined();
    if (initLog) {
      const parsed = JSON.parse(initLog.payload as string);
      expect(parsed).toMatchObject({
        event: 'download_store_init',
        mode: 'upstash',
        durable_required: true,
        allow_in_memory_honored: false,
        node_env: 'production',
        vercel_env: 'production',
      });
    }
  });

  it.openspec('OA-DST-037')('warn log emitted when DOWNLOAD_ALLOW_IN_MEMORY honored outside production', () => {
    const log = makeLog();
    const env = envOnly({
      // No NODE_ENV/VERCEL_ENV set: simulates a self-hosted single-instance deploy.
      DOWNLOAD_ALLOW_IN_MEMORY: '1',
    });
    const result = initDownloadArtifactStore(env, { log });
    expect(result.mode).toBe('memory');
    const warnLog = log.calls.find((c) => c.level === 'warn');
    expect(warnLog).toBeDefined();
    if (warnLog) {
      const parsed = JSON.parse(warnLog.payload as string);
      expect(parsed.allow_in_memory_honored).toBe(true);
      expect(parsed.warning).toMatch(/not safe across serverless instances/);
    }
  });

  it.openspec('OA-DST-036')('NODE_ENV=test always uses in-memory and skips logging', () => {
    const log = makeLog();
    const env = envOnly({ NODE_ENV: 'test' });
    const result = initDownloadArtifactStore(env, { log });
    expect(result.mode).toBe('memory');
    expect(log.calls).toHaveLength(0);
  });
});

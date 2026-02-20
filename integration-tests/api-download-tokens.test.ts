/**
 * Unit tests for signed opaque download IDs (sign/verify/expiry).
 * These are pure helper tests — no endpoint mocking needed.
 */

import { describe, expect } from 'vitest';
import { itAllure, allureStep, allureJsonAttachment } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

const { createDownloadArtifact, resolveDownloadArtifact } = await import('../api/_shared.js');

describe('Download IDs — sign / verify / expiry', () => {
  const TEMPLATE = 'common-paper-mutual-nda';
  const VALUES = { company_name: 'Acme Corp', counterparty_name: 'Globex Inc' };

  it('round-trips a valid signed download_id', async () => {
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

  it('rejects a tampered signature', async () => {
    const created = await createDownloadArtifact(TEMPLATE, VALUES);
    const tampered = created.download_id.slice(0, -1)
      + (created.download_id.endsWith('A') ? 'B' : 'A');

    const resolved = await resolveDownloadArtifact(tampered);
    expect(resolved).toEqual({ ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' });
  });

  it('rejects malformed download_id values', async () => {
    await expect(resolveDownloadArtifact('')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
    await expect(resolveDownloadArtifact('no-dot-here')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
    await expect(resolveDownloadArtifact('.leading-dot')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
    await expect(resolveDownloadArtifact('nothex.not-base64')).resolves.toEqual({ ok: false, code: 'DOWNLOAD_ID_MALFORMED' });
  });

  it('rejects an expired download_id', async () => {
    const created = await createDownloadArtifact(TEMPLATE, VALUES, { ttl_ms: -1 });
    const resolved = await resolveDownloadArtifact(created.download_id);
    expect(resolved).toEqual({ ok: false, code: 'DOWNLOAD_EXPIRED' });
  });

  it('preserves empty values object', async () => {
    const created = await createDownloadArtifact(TEMPLATE, {});
    const resolved = await resolveDownloadArtifact(created.download_id);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.artifact.values).toEqual({});
    }
  });

  it('keeps download_id length stable as values grow', async () => {
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

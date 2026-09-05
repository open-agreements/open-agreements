import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { canonicalSha256, type FieldSelectorSchemaManifest } from '../core/field-selector/input-schema.js';
import { runFieldSelectorSchema } from './field-selector-schema.js';

describe('field-selector schema command', () => {
  it('writes a complete deterministic bundle and reports its canonical hash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-schema-bundle-'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    runFieldSelectorSchema({
      all: true,
      outputDir: dir,
      runtimeRevision: '0'.repeat(40),
    });
    const manifest = JSON.parse(readFileSync(join(dir, 'schema-manifest.json'), 'utf8')) as FieldSelectorSchemaManifest;
    expect(manifest.runtime_revision).toBe('0'.repeat(40));
    expect(manifest.schemas).toHaveLength(7);
    expect(manifest.schemas.map((item) => item.field_selector_id)).toEqual(
      [...manifest.schemas.map((item) => item.field_selector_id)].sort(),
    );
    for (const item of manifest.schemas) {
      const schema = JSON.parse(readFileSync(join(dir, item.path), 'utf8')) as unknown;
      expect(canonicalSha256(schema)).toBe(item.sha256);
    }
    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
      manifest_path: 'schema-manifest.json',
      manifest_sha256: canonicalSha256(manifest),
    });
    log.mockRestore();
  });

  it('rejects incomplete or ambiguous all-mode provenance', () => {
    expect(() => runFieldSelectorSchema({ all: true })).toThrow(/output-dir/);
    expect(() => runFieldSelectorSchema({ all: true, outputDir: '/tmp/x' })).toThrow(/runtime-revision/);
    expect(() => runFieldSelectorSchema({ all: true, fieldSelectorId: 'x', outputDir: '/tmp/x', runtimeRevision: '0'.repeat(40) })).toThrow(/together/);
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main, parseArgs } from '../scripts/validate_openspec_coverage.mjs';

describe('validate_openspec_coverage script', () => {
  it('parses args without writing matrix by default', () => {
    const parsed = parseArgs([]);
    expect(parsed.capabilities).toEqual([]);
    expect(parsed.writeMatrixPath).toBeNull();
  });

  it('parses --write-matrix with default path when value is omitted', () => {
    const parsed = parseArgs(['--write-matrix'], '/tmp/open-agreements');
    expect(parsed.writeMatrixPath).toMatch(/integration-tests\/OPENSPEC_TRACEABILITY\.md$/);
  });

  it('parses --write-matrix with a custom path relative to cwd', () => {
    const parsed = parseArgs(['--write-matrix', 'reports/matrix.md'], '/tmp/open-agreements');
    expect(parsed.writeMatrixPath).toBe('/tmp/open-agreements/reports/matrix.md');
  });

  it('only writes a matrix when requested', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-speccov-'));
    const matrixPath = join(tempDir, 'traceability.md');
    try {
      process.exitCode = 0;
      await main(['--capability', 'open-agreements']);
      expect(existsSync(matrixPath)).toBe(false);

      await main(['--capability', 'open-agreements', '--write-matrix', matrixPath]);
      expect(existsSync(matrixPath)).toBe(true);
      expect(readFileSync(matrixPath, 'utf-8')).toContain('# OpenAgreements OpenSpec Traceability Matrix');
    } finally {
      process.exitCode = 0;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

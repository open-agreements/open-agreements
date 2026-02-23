import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import {
  checksumSha256,
  fetchCatalogEntries,
  validateCatalog,
} from '../src/core/catalog.js';
import type { FormsCatalog } from '../src/core/types.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Compliance & Governance');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('catalog validation and fetch', () => {
  it.openspec('OA-120')('accepts entries with source_url and checksum', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-catalog-valid-'));
    tempDirs.push(root);

    const validCatalog = {
      schema_version: 1,
      entries: [
        {
          id: 'with-checksum',
          name: 'With checksum',
          source_url: 'https://example.com/form.docx',
          checksum: {
            sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          license: {
            type: 'CC-BY-4.0',
            redistribution: 'allowed-unmodified',
          },
        },
      ],
    };

    const catalogPath = join(root, 'forms-catalog.yaml');
    writeFileSync(catalogPath, dump(validCatalog), 'utf-8');

    const result = validateCatalog(catalogPath);
    expect(result.valid).toBe(true);
  });

  it.openspec('OA-121')('rejects entries missing checksum', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-catalog-invalid-'));
    tempDirs.push(root);

    const invalidCatalog = {
      schema_version: 1,
      entries: [
        {
          id: 'missing-checksum',
          name: 'Missing checksum',
          source_url: 'https://example.com/form.docx',
          license: {
            type: 'CC-BY-4.0',
            redistribution: 'allowed-unmodified',
          },
        },
      ],
    };

    const catalogPath = join(root, 'forms-catalog.yaml');
    writeFileSync(catalogPath, dump(invalidCatalog), 'utf-8');

    const result = validateCatalog(catalogPath);
    expect(result.valid).toBe(false);
  });

  it.openspec(['OA-122', 'OA-123', 'OA-124'])(
    'downloads allowed entries, skips pointer-only entries, and blocks checksum mismatches',
    async () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-catalog-fetch-'));
    tempDirs.push(root);

    const validBuffer = Buffer.from('contract-data');
    const validHash = checksumSha256(validBuffer);

    const catalog: FormsCatalog = {
      schema_version: 1,
      entries: [
        {
          id: 'allowed',
          name: 'Allowed document',
          source_url: 'https://example.com/allowed.docx',
          checksum: { sha256: validHash },
          license: { type: 'CC-BY-4.0', redistribution: 'allowed-unmodified' },
          destination_lifecycle: 'forms',
          destination_topic: 'finance',
          destination_filename: 'allowed.docx',
        },
        {
          id: 'pointer',
          name: 'Pointer only doc',
          source_url: 'https://example.com/pointer.docx',
          checksum: {
            sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          license: { type: 'Proprietary', redistribution: 'pointer-only' },
        },
        {
          id: 'bad-hash',
          name: 'Bad hash doc',
          source_url: 'https://example.com/bad.docx',
          checksum: {
            sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
          license: { type: 'CC-BY-4.0', redistribution: 'allowed-unmodified' },
          destination_lifecycle: 'forms',
          destination_topic: 'finance',
          destination_filename: 'bad.docx',
        },
      ],
    };

    const catalogPath = join(root, 'forms-catalog.yaml');
    writeFileSync(catalogPath, dump(catalog), 'utf-8');

    const downloader = async (url: string): Promise<Buffer> => {
      if (url.includes('allowed.docx')) {
        return validBuffer;
      }
      return Buffer.from('other-data');
    };

    const summary = await fetchCatalogEntries({
      rootDir: root,
      catalogFilePath: catalogPath,
      downloader,
    });

    expect(summary.downloadedCount).toBe(1);
    expect(summary.pointerOnlyCount).toBe(1);
    expect(summary.failedCount).toBe(1);

    const allowedPath = join(root, 'forms', 'finance', 'allowed.docx');
    expect(existsSync(allowedPath)).toBe(true);
    expect(readFileSync(allowedPath).toString()).toBe(validBuffer.toString());

    const badPath = join(root, 'forms', 'finance', 'bad.docx');
    expect(existsSync(badPath)).toBe(false);
    }
  );
});

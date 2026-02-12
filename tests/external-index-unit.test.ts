import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  allureJsonAttachment,
  itAllure,
} from './helpers/allure-test.js';

const itFilling = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

function createExternalFixture(overrides?: { sourceSha256?: string }) {
  const root = mkdtempSync(join(tmpdir(), 'oa-external-unit-'));
  tempDirs.push(root);

  const templatePath = join(root, 'template.docx');
  const templateBytes = Buffer.from('fixture-template-bytes');
  writeFileSync(templatePath, templateBytes);

  const actualSha = createHash('sha256').update(templateBytes).digest('hex');
  const sourceSha256 = overrides?.sourceSha256 ?? actualSha;

  writeFileSync(
    join(root, 'metadata.yaml'),
    [
      'name: Fixture External',
      'source_url: https://example.com/external.docx',
      'version: "1.0"',
      'license: CC-BY-ND-4.0',
      'allow_derivatives: false',
      'attribution_text: Example attribution',
      `source_sha256: ${sourceSha256}`,
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company name',
      'required_fields:',
      '  - company_name',
      '',
    ].join('\n'),
    'utf-8'
  );

  writeFileSync(
    join(root, 'replacements.json'),
    JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
    'utf-8'
  );

  return { root, actualSha };
}

describe('runExternalFill', () => {
  itFilling.openspec('OA-043')('passes requiredFieldNames through to unified fill pipeline', async () => {
    const { root } = createExternalFixture();

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      stages: {},
    }));

    vi.doMock('../src/utils/paths.js', () => ({
      resolveExternalDir: () => root,
    }));

    vi.doMock('../src/core/unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runExternalFill } = await import('../src/core/external/index.js');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runExternalFill({
      externalId: 'fixture-external',
      outputPath: '/tmp/external-output.docx',
      values: { company_name: 'Acme Corp' },
    });

    await allureJsonAttachment('runExternalFill-forwarding.json', {
      pipelineCall: runFillPipelineMock.mock.calls[0]?.[0],
      result,
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(runFillPipelineMock).toHaveBeenCalledTimes(1);
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      requiredFieldNames: ['company_name'],
      values: { company_name: 'Acme Corp' },
    });
    expect(result.fieldsUsed).toEqual(['company_name']);
  });

  itFilling('fails integrity check when source_sha256 does not match template bytes', async () => {
    const { root } = createExternalFixture({ sourceSha256: 'f'.repeat(64) });

    const runFillPipelineMock = vi.fn();

    vi.doMock('../src/utils/paths.js', () => ({
      resolveExternalDir: () => root,
    }));

    vi.doMock('../src/core/unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runExternalFill } = await import('../src/core/external/index.js');

    await expect(
      runExternalFill({
        externalId: 'fixture-external',
        outputPath: '/tmp/external-output.docx',
        values: { company_name: 'Acme Corp' },
      })
    ).rejects.toThrow('Integrity check failed');

    expect(runFillPipelineMock).not.toHaveBeenCalled();
  });
});

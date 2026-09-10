import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  allureJsonAttachment,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';

const itFilling = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../field-selector/verifier.js');
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
      'priority_fields:',
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
  itFilling('passes priorityFieldNames through to unified fill pipeline', async () => {
    const { root } = createExternalFixture();

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: [],
      stages: {},
    }));

    vi.doMock('../../utils/paths.js', () => ({
      resolveExternalDir: () => root,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runExternalFill } = await import('./index.js');

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
      priorityFieldNames: ['company_name'],
      values: { company_name: 'Acme Corp' },
    });
    expect(result.fieldsUsed).toEqual(['company_name']);
  });

  itFilling('wires configured signature bindings before patching an external document', async () => {
    const {root} = createExternalFixture();
    writeFileSync(join(root, 'anchored-paragraph-bindings.json'), JSON.stringify({groups: [{
      id: 'final', start_anchor: 'INVESTOR:', end_at_document_end: true, expected_group_matches: 1,
      bindings: [{label: 'Name:', field: 'company_name', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true}],
    }]}));
    const bind = vi.fn();
    vi.doMock('../../utils/paths.js', () => ({resolveExternalDir: () => root}));
    vi.doMock('../field-selector/anchored-paragraph-bindings.js', async () => {
      const actual = await vi.importActual<typeof import('../field-selector/anchored-paragraph-bindings.js')>('../field-selector/anchored-paragraph-bindings.js');
      return {...actual, bindAnchoredParagraphFields: bind};
    });
    vi.doMock('../unified-pipeline.js', () => ({runFillPipeline: async (options: {
      prePatchProcess: (input: string, output: string) => Promise<unknown>;
    }) => {
      await options.prePatchProcess('/tmp/clean.docx', '/tmp/bound.docx');
      return {outputPath: '/tmp/filled.docx', fieldsUsed: [], providedFieldsUsed: [], fillCommandCount: 1, warnings: [], stages: {}};
    }}));
    try {
      const {runExternalFill} = await import('./index.js');
      await runExternalFill({externalId: 'fixture', outputPath: '/tmp/filled.docx', values: {company_name: 'Acme'}});
      expect(bind).toHaveBeenCalledWith('/tmp/clean.docx', '/tmp/bound.docx', expect.objectContaining({groups: expect.any(Array)}));
    } finally { vi.doUnmock('../field-selector/anchored-paragraph-bindings.js'); }
  });

  itFilling('verifies ISO dates using the exact display value rendered by the fill pipeline', async () => {
    const {root} = createExternalFixture();
    const metadataPath = join(root, 'metadata.yaml');
    writeFileSync(metadataPath, readFileSync(metadataPath, 'utf8').replace('priority_fields:',
      '  - name: date_of_safe\n    type: date\n    description: Date\npriority_fields:'));
    const verify = vi.fn(async () => ({passed: true, checks: []}));
    vi.doMock('../../utils/paths.js', () => ({resolveExternalDir: () => root}));
    vi.doMock('../field-selector/verifier.js', () => ({verifyOutput: verify}));
    vi.doMock('../unified-pipeline.js', () => ({runFillPipeline: async (options: {
      verify: (output: string, source: string) => Promise<unknown>;
    }) => {
      await options.verify('/tmp/filled.docx', '/tmp/cleaned.docx');
      return {outputPath: '/tmp/filled.docx', fieldsUsed: [], providedFieldsUsed: [], fillCommandCount: 1, warnings: [], stages: {}};
    }}));
    const {runExternalFill} = await import('./index.js');
    await runExternalFill({externalId: 'fixture', outputPath: '/tmp/filled.docx', values: {date_of_safe: '2026-09-21'}});
    expect(verify).toHaveBeenCalledWith('/tmp/filled.docx', {date_of_safe: 'September 21, 2026'}, expect.any(Object), expect.any(Object), '/tmp/cleaned.docx');
  });

  itFilling('fails integrity check when source_sha256 does not match template bytes', async () => {
    const { root } = createExternalFixture({ sourceSha256: 'f'.repeat(64) });

    const runFillPipelineMock = vi.fn();

    vi.doMock('../../utils/paths.js', () => ({
      resolveExternalDir: () => root,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runExternalFill } = await import('./index.js');

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

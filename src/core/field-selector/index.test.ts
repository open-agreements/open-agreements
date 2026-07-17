import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
});

function createFieldSelectorFixture(options?: { computedProfile?: unknown; normalizeConfig?: unknown }) {
  const root = mkdtempSync(join(tmpdir(), 'oa-field-selector-index-'));
  tempDirs.push(root);

  writeFileSync(
    join(root, 'metadata.yaml'),
    [
      'name: Fixture FieldSelector',
      'source_url: https://example.com/source.docx',
      'source_version: "1.0"',
      'license_note: Example fieldSelector license',
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

  if (options?.computedProfile) {
    writeFileSync(
      join(root, 'computed.json'),
      `${JSON.stringify(options.computedProfile, null, 2)}\n`,
      'utf-8'
    );
  }

  if (options?.normalizeConfig) {
    writeFileSync(
      join(root, 'normalize.json'),
      `${JSON.stringify(options.normalizeConfig, null, 2)}\n`,
      'utf-8'
    );
  }

  return root;
}

describe('runFieldSelector', () => {
  itFilling('forwards priorityFieldNames when inputPath is supplied', async () => {
    const fieldSelectorDir = createFieldSelectorFixture();

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: [],
      stages: {
        cleaned: '/tmp/cleaned.docx',
        patched: '/tmp/patched.docx',
        filled: '/tmp/filled.docx',
      },
    }));

    vi.doMock('../../utils/paths.js', () => ({
      resolveFieldSelectorDir: () => fieldSelectorDir,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runFieldSelector } = await import('./index.js');

    const result = await runFieldSelector({
      fieldSelectorId: 'fixture-fieldSelector',
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      values: { company_name: 'Acme Corp' },
    });

    await allureJsonAttachment('runFieldSelector-forwarding.json', {
      pipelineCall: runFillPipelineMock.mock.calls[0]?.[0],
      result,
    });

    expect(runFillPipelineMock).toHaveBeenCalledTimes(1);
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      priorityFieldNames: ['company_name'],
      values: { company_name: 'Acme Corp' },
    });
    expect(result.fieldsUsed).toEqual(['company_name']);
  });

  itFilling('applies computed rules and captures pass-level trace', async () => {
    const computedProfile = {
      version: '1.0',
      max_passes: 3,
      rules: [
        {
          id: 'derive-dispute-track-courts',
          when_all: [{ field: 'dispute_resolution_mode', op: 'eq', value: 'courts' }],
          set_audit: { dispute_resolution_track: 'courts' },
        },
        {
          id: 'derive-governing-law-baseline',
          set_audit: { governing_law_state: 'delaware' },
        },
        {
          id: 'derive-forum-governing-mismatch',
          when_all: [
            { field: 'dispute_resolution_track', op: 'eq', value: 'courts' },
            { field: 'state_lower', op: 'neq', value: 'delaware' },
          ],
          set_audit: { forum_governing_law_alignment: 'mismatch' },
        },
        {
          id: 'derive-judicial-district-default-california',
          when_all: [
            { field: 'dispute_resolution_track', op: 'eq', value: 'courts' },
            { field: 'state_lower', op: 'eq', value: 'california' },
            { field: 'judicial_district', op: 'falsy' },
          ],
          set_fill: { judicial_district: 'Northern District of California' },
        },
      ],
    };
    const fieldSelectorDir = createFieldSelectorFixture({ computedProfile });
    const computedOutPath = join(fieldSelectorDir, 'computed-output.json');

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: [],
      stages: {
        cleaned: '/tmp/cleaned.docx',
        patched: '/tmp/patched.docx',
        filled: '/tmp/filled.docx',
      },
    }));

    vi.doMock('../../utils/paths.js', () => ({
      resolveFieldSelectorDir: () => fieldSelectorDir,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runFieldSelector } = await import('./index.js');

    const result = await runFieldSelector({
      fieldSelectorId: 'fixture-fieldSelector',
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      values: {
        company_name: 'Acme Corp',
        dispute_resolution_mode: 'courts',
        state_lower: 'california',
      },
      computedOutPath,
    });

    const artifact = JSON.parse(readFileSync(computedOutPath, 'utf-8')) as Record<string, unknown>;
    await allureJsonAttachment('runFieldSelector-computed-artifact.json', artifact);

    expect(runFillPipelineMock).toHaveBeenCalledTimes(1);
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      values: expect.objectContaining({
        company_name: 'Acme Corp',
        dispute_resolution_mode: 'courts',
        state_lower: 'california',
        judicial_district: 'Northern District of California',
      }),
    });

    expect(artifact).toMatchObject({
      field_selector_id: 'fixture-fieldSelector',
      profile_present: true,
      derived_audit_values: {
        dispute_resolution_track: 'courts',
        governing_law_state: 'delaware',
        forum_governing_law_alignment: 'mismatch',
      },
      derived_fill_values: {
        judicial_district: 'Northern District of California',
      },
    });
    expect(Array.isArray(artifact.passes)).toBe(true);
    expect(result.computedOutPath).toBe(computedOutPath);
  });

  itFilling('uses downloader path when inputPath is omitted', async () => {
    const fieldSelectorDir = createFieldSelectorFixture();
    const ensureSourceDocxMock = vi.fn(async () => '/tmp/downloaded-source.docx');

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: [],
      stages: {
        cleaned: '/tmp/cleaned.docx',
        patched: '/tmp/patched.docx',
        filled: '/tmp/filled.docx',
      },
    }));

    vi.doMock('../../utils/paths.js', () => ({
      resolveFieldSelectorDir: () => fieldSelectorDir,
    }));

    vi.doMock('./downloader.js', () => ({
      ensureSourceDocx: ensureSourceDocxMock,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runFieldSelector } = await import('./index.js');

    await runFieldSelector({
      fieldSelectorId: 'fixture-fieldSelector',
      outputPath: '/tmp/output.docx',
      values: { company_name: 'Acme Corp' },
    });

    expect(ensureSourceDocxMock).toHaveBeenCalledWith('fixture-fieldSelector', expect.any(Object));
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      inputPath: '/tmp/downloaded-source.docx',
    });
  });

  itFilling('loads normalize.json rules and passes field values into post-process normalization', async () => {
    const fieldSelectorDir = createFieldSelectorFixture({
      normalizeConfig: {
        paragraph_rules: [
          {
            id: 'fill-company-counsel-name',
            section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
            paragraph_contains: 'The Purchasers shall have received from',
            replacements: {
              '[___________]': '{company_counsel_name}',
            },
            trim_unmatched_trailing_bracket: true,
          },
        ],
      },
    });

    const normalizeMock = vi.fn(async () => ({
      unbracketedSegments: 0,
      removedSegments: 0,
      removedParagraphs: 0,
      normalizedParagraphs: 0,
      declarativeRuleApplications: 1,
    }));

    const runFillPipelineMock = vi.fn(async ({ outputPath, postProcess }: { outputPath: string; postProcess?: (p: string) => Promise<void> }) => {
      if (postProcess) {
        await postProcess(outputPath);
      }
      return {
        outputPath,
        fieldsUsed: ['company_name', 'company_counsel_name'],
        providedFieldsUsed: ['company_name', 'company_counsel_name'],
        fillCommandCount: 1,
        warnings: [],
        stages: {
          cleaned: '/tmp/cleaned.docx',
          patched: '/tmp/patched.docx',
          filled: '/tmp/filled.docx',
        },
      };
    });

    vi.doMock('../../utils/paths.js', () => ({
      resolveFieldSelectorDir: () => fieldSelectorDir,
    }));

    vi.doMock('./bracket-normalizer.js', () => ({
      normalizeBracketArtifacts: normalizeMock,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runFieldSelector } = await import('./index.js');

    await runFieldSelector({
      fieldSelectorId: 'fixture-fieldSelector',
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      values: { company_name: 'Acme Corp', company_counsel_name: 'Cooley LLP' },
      normalizeBracketArtifacts: true,
    });

    expect(normalizeMock).toHaveBeenCalledTimes(1);
    expect(normalizeMock.mock.calls[0]).toEqual([
      '/tmp/output.docx',
      '/tmp/output.docx',
      {
        rules: [
          expect.objectContaining({
            id: 'fill-company-counsel-name',
          }),
        ],
        fieldValues: {
          company_name: 'Acme Corp',
          company_counsel_name: 'Cooley LLP',
        },
      },
    ]);
  });

  // Issue #620 regression: the verifier must compare `type: date` fields
  // against the FORMATTED date the fill actually writes (prepareFillData
  // renders ISO "2026-03-15" as "March 15, 2026"), not the raw ISO input.
  // Before the fix, every ISO-supplied date field produced a spurious
  // 'verify: ... Missing: <field>="<iso>"' warning.
  itFilling('ISO date input verifies against the formatted document date (no spurious Missing warning)', async () => {
    const fieldSelectorDir = createFieldSelectorFixture();
    // Mirror the MRL dateline shape: a date-typed field bound to the full
    // "[______], 20[__]" slot.
    writeFileSync(
      join(fieldSelectorDir, 'metadata.yaml'),
      [
        'name: Fixture Date FieldSelector',
        'source_url: https://example.com/source.docx',
        'source_version: "1.0"',
        'license_note: Example fieldSelector license',
        'fields:',
        '  - name: letter_date',
        '    type: date',
        '    description: Date of the letter',
        'priority_fields:',
        '  - letter_date',
        '',
      ].join('\n'),
      'utf-8'
    );
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify({ '[______], 20[__]': '{letter_date}' }, null, 2),
      'utf-8'
    );

    const { mkdtempSync: mkTemp } = await import('node:fs');
    const { tmpdir: osTmp } = await import('node:os');
    const AdmZip = (await import('adm-zip')).default;
    const workDir = mkTemp(join(osTmp(), 'oa-issue-620-date-'));
    tempDirs.push(workDir);
    const inputPath = join(workDir, 'input.docx');
    const outputPath = join(workDir, 'output.docx');
    const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const zip = new AdmZip();
    zip.addFile(
      'word/document.xml',
      Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          `<w:document xmlns:w="${W_NS}"><w:body>` +
          '<w:p><w:r><w:t xml:space="preserve">[______], 20[__]</w:t></w:r></w:p>' +
          '</w:body></w:document>',
        'utf-8'
      )
    );
    zip.addFile(
      '[Content_Types].xml',
      Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '</Types>',
        'utf-8'
      )
    );
    zip.writeZip(inputPath);

    // Earlier tests in this file register module mocks for the fill pipeline
    // and downloader; this test must run the REAL pipeline end-to-end.
    vi.doUnmock('../unified-pipeline.js');
    vi.doUnmock('./downloader.js');
    vi.doMock('../../utils/paths.js', () => ({
      resolveFieldSelectorDir: () => fieldSelectorDir,
    }));
    const { runFieldSelector } = await import('./index.js');

    const result = await runFieldSelector({
      fieldSelectorId: 'fixture-date-fieldSelector',
      inputPath,
      outputPath,
      values: { letter_date: '2026-03-15' },
    });

    await allureJsonAttachment('iso-date-verification-result.json', result);

    const outZip = new AdmZip(result.outputPath);
    const outXml = outZip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
    // The formatted date is written, the ISO input is not.
    expect(outXml).toContain('March 15, 2026');
    expect(outXml).not.toContain('2026-03-15');
    // And the verifier no longer reports the field as missing.
    const missingWarnings = result.warnings.filter((w) => w.includes('Missing') && w.includes('letter_date'));
    expect(missingWarnings).toEqual([]);
  });
});


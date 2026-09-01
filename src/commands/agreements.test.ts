import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import {
  runAgreementCreate,
  runAgreementList,
  runAgreementRender,
  runAgreementReview,
  runAgreementShow,
  runAgreementUpdate,
} from './agreements.js';

const it = itAllure.epic('Filling & Rendering');

describe('local agreement commands', () => {
  let tempRoot: string;
  let stateRoot: string;
  let templateDir: string;
  let previousContentRoots: string | undefined;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'open-agreements-local-'));
    stateRoot = join(tempRoot, 'state');
    templateDir = join(tempRoot, 'templates', 'fixtures-cc0', 'fixture-nda');
    mkdirSync(templateDir, { recursive: true });
    writeFileSync(join(templateDir, 'template.docx'), 'fixture template bytes');
    writeFileSync(join(templateDir, 'metadata.yaml'), `
name: Fixture NDA
source_url: https://example.com/fixture-nda
version: "1.2.3"
license: CC0-1.0
allow_derivatives: true
attribution_text: Fixture
fields:
  - name: party_name
    type: string
    description: Party name
  - name: unchanged
    type: boolean
    description: Unchanged flag
  - name: a
    type: number
    description: Concurrent value A
  - name: b
    type: number
    description: Concurrent value B
  - name: defaulted_term
    type: string
    description: Defaulted priority term
    default: present
priority_fields:
  - party_name
  - defaulted_term
artifact_kind: agreement
capabilities:
  - create
  - review
  - render
party_roles:
  - disclosing_party
  - receiving_party
signature_roles:
  - disclosing_party
  - receiving_party
mutation_policy: fields_only
maturity: experimental
`.trimStart());
    previousContentRoots = process.env.OPEN_AGREEMENTS_CONTENT_ROOTS;
    process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = tempRoot;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (previousContentRoots === undefined) delete process.env.OPEN_AGREEMENTS_CONTENT_ROOTS;
    else process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = previousContentRoots;
    vi.restoreAllMocks();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  async function create(terms: Record<string, unknown> = {}) {
    return runAgreementCreate({ template: 'fixture-nda', terms, root: stateRoot });
  }

  it('agreements create persists template provenance, revision, and terms', async () => {
    const record = await create({ party_name: 'Acme' });
    const stored = JSON.parse(readFileSync(join(stateRoot, record.id, 'agreement.json'), 'utf-8'));
    expect(stored).toMatchObject({
      id: record.id,
      template: { id: 'fixture-nda', version: '1.2.3' },
      revision: 1,
      terms: { party_name: 'Acme' },
      review: null,
      rendered_document: null,
    });
    expect(stored.template.source_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('agreements create hashes template.fill.docx when both artifacts exist', async () => {
    writeFileSync(join(templateDir, 'template.fill.docx'), 'actual fill source');
    const record = await create();
    expect(record.template.source_sha256).toBe(
      createHash('sha256').update('actual fill source').digest('hex')
    );
  });

  it('agreements list returns persisted records', async () => {
    const created = await create();
    const records = await runAgreementList({ root: stateRoot });
    expect(records.map((record) => record.id)).toEqual([created.id]);
  });

  it('agreements show returns the complete record', async () => {
    const created = await create({ party_name: 'Acme' });
    const shown = await runAgreementShow({ id: created.id, json: true, root: stateRoot });
    expect(shown).toEqual(created);
  });

  it('agreements update merges terms, advances revision, and enforces optimistic revision', async () => {
    const created = await create({ party_name: 'Acme', unchanged: true });
    const updated = await runAgreementUpdate({
      id: created.id,
      terms: { party_name: 'Beta' },
      revision: 1,
      root: stateRoot,
    });
    expect(updated).toMatchObject({ revision: 2, terms: { party_name: 'Beta', unchanged: true } });
    await expect(runAgreementUpdate({ id: created.id, terms: { party_name: 'Gamma' }, revision: 1, root: stateRoot }))
      .rejects.toThrow('Revision conflict');
  });

  it('agreements update serializes concurrent optimistic updates', async () => {
    const created = await create();
    const results = await Promise.allSettled([
      runAgreementUpdate({ id: created.id, terms: { a: 1 }, revision: 1, root: stateRoot }),
      runAgreementUpdate({ id: created.id, terms: { b: 1 }, revision: 1, root: stateRoot }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('agreements update rejects empty and unknown fields', async () => {
    const created = await create();
    await expect(runAgreementUpdate({ id: created.id, terms: {}, root: stateRoot }))
      .rejects.toThrow('At least one term');
    await expect(runAgreementUpdate({ id: created.id, terms: { invented: true }, root: stateRoot }))
      .rejects.toThrow('Unknown term field');
  });

  it('agreements review persists missing-priority warnings for the current revision', async () => {
    const created = await create();
    const reviewed = await runAgreementReview({ id: created.id, root: stateRoot });
    expect(reviewed.review).toMatchObject({
      revision: 1,
      warnings: ['Priority term is unfilled: party_name'],
    });
  });

  it('agreements list skips corrupt sibling records', async () => {
    const created = await create();
    const corruptId = '11111111-1111-4111-8111-111111111111';
    mkdirSync(join(stateRoot, corruptId), { recursive: true });
    writeFileSync(join(stateRoot, corruptId, 'agreement.json'), '{broken');
    const records = await runAgreementList({ root: stateRoot });
    expect(records.map((record) => record.id)).toEqual([created.id]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('skipping unreadable agreement'));
  });

  it('agreements render persists the rendered document SHA-256', async () => {
    const created = await create({ party_name: 'Acme' });
    const output = join(tempRoot, 'rendered.docx');
    const rendered = await runAgreementRender({
      id: created.id,
      output,
      root: stateRoot,
      renderer: async (options) => {
        writeFileSync(options.outputPath, 'rendered fixture bytes');
        return {
          outputPath: options.outputPath,
          metadata: (await import('../core/metadata.js')).loadMetadata(options.templateDir),
          fieldsUsed: ['party_name'],
          providedFieldsUsed: ['party_name'],
          fillCommandCount: 1,
          warnings: ['fixture render warning'],
        };
      },
    });
    expect(rendered.rendered_document).toMatchObject({
      revision: 1,
      path: output,
      warnings: ['fixture render warning'],
    });
    expect(rendered.rendered_document?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

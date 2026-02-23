import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { INDEX_FILE } from '../src/core/constants.js';
import { buildStatusIndex, collectWorkspaceDocuments, hasExecutedMarker, writeStatusIndex } from '../src/core/indexer.js';
import { lintWorkspace } from '../src/core/lint.js';
import { initializeWorkspace } from '../src/core/workspace-structure.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Verification & Drift');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('status and lint', () => {
  it.openspec(['OA-125', 'OA-126'])('infers executed marker from filename', () => {
    expect(hasExecutedMarker('nda_executed.docx')).toBe(true);
    expect(hasExecutedMarker('nda.docx')).toBe(false);
  });

  it.openspec('OA-128')('collects document records and reports lint findings', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-status-lint-'));
    tempDirs.push(root);

    initializeWorkspace(root);

    // Init no longer creates lifecycle dirs — create them for this test
    mkdirSync(join(root, 'forms', 'corporate'), { recursive: true });
    mkdirSync(join(root, 'executed'), { recursive: true });
    mkdirSync(join(root, 'drafts'), { recursive: true });

    writeFileSync(join(root, 'forms', 'corporate', 'template.pdf'), 'pdf-bytes');
    writeFileSync(join(root, 'executed', 'unsigned.docx'), 'docx-bytes');
    writeFileSync(join(root, 'drafts', 'draft_executed.docx'), 'docx-bytes');

    const docs = collectWorkspaceDocuments(root);
    expect(docs.length).toBe(3);

    const lint = lintWorkspace(root);
    expect(lint.findings.some((finding) => finding.code === 'disallowed-file-type')).toBe(true);
    expect(lint.findings.some((finding) => finding.code === 'missing-executed-marker')).toBe(true);
    expect(lint.findings.some((finding) => finding.code === 'executed-marker-outside-executed')).toBe(true);
  });

  it.openspec(['OA-127', 'OA-129'])(
    'detects stale contracts-index.yaml when files are newer than the index',
    () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-status-stale-'));
    tempDirs.push(root);

    initializeWorkspace(root);
    mkdirSync(join(root, 'incoming'), { recursive: true });
    const agreementPath = join(root, 'incoming', 'partner_msa.docx');
    writeFileSync(agreementPath, 'docx-bytes');

    const docs = collectWorkspaceDocuments(root);
    const lintBefore = lintWorkspace(root);
    const index = buildStatusIndex(root, docs, lintBefore);
    writeStatusIndex(root, index, INDEX_FILE);

    const oldDate = new Date(Date.now() - 5_000);
    utimesSync(join(root, INDEX_FILE), oldDate, oldDate);

    writeFileSync(agreementPath, 'docx-bytes-updated');

    const lintAfter = lintWorkspace(root);
    expect(lintAfter.findings.some((finding) => finding.code === 'stale-index')).toBe(true);
    }
  );
});

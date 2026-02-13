import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../tests/helpers/allure-test.js';
import { defaultConventions, loadConventions, writeConventions } from '../src/core/convention-config.js';
import { scanExistingConventions } from '../src/core/convention-scanner.js';
import { FilesystemProvider } from '../src/core/filesystem-provider.js';
import { MemoryProvider } from '../src/core/memory-provider.js';
import { initializeWorkspace } from '../src/core/workspace-structure.js';
import { lintWorkspace } from '../src/core/lint.js';
import { hasExecutedMarker } from '../src/core/indexer.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Platform & Distribution');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('convention config', () => {
  it('defaultConventions returns valid config', () => {
    const config = defaultConventions();
    expect(config.schema_version).toBe(1);
    expect(config.executed_marker.pattern).toBe('_executed');
    expect(config.naming.style).toBe('snake_case');
    expect(config.lifecycle.applicable_domains).toContain('forms');
  });

  it('write and load round-trip with MemoryProvider', () => {
    const provider = new MemoryProvider('/test');
    const config = defaultConventions();
    config.naming.style = 'kebab-case';

    writeConventions(provider, config);
    const loaded = loadConventions(provider);
    expect(loaded.naming.style).toBe('kebab-case');
    expect(loaded.schema_version).toBe(1);
  });

  it('loadConventions returns defaults when file is missing', () => {
    const provider = new MemoryProvider('/test');
    const config = loadConventions(provider);
    expect(config).toEqual(defaultConventions());
  });

  it('write and load round-trip with FilesystemProvider', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-conv-'));
    tempDirs.push(root);
    const provider = new FilesystemProvider(root);
    const config = defaultConventions();
    config.executed_marker.pattern = '_signed';

    writeConventions(provider, config);
    const loaded = loadConventions(provider);
    expect(loaded.executed_marker.pattern).toBe('_signed');
  });
});

describe('convention scanner', () => {
  it('returns defaults for empty workspace', () => {
    const provider = new MemoryProvider('/test');
    const config = scanExistingConventions(provider);
    expect(config).toEqual(defaultConventions());
  });

  it('returns defaults when fewer than 5 files exist', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('contracts/nda.docx', 'a');
    provider.seed('contracts/msa.docx', 'b');
    const config = scanExistingConventions(provider);
    expect(config.executed_marker.pattern).toBe('_executed');
  });

  it('detects _executed marker pattern from majority of files', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('executed/nda_executed.docx', 'a');
    provider.seed('executed/msa_executed.docx', 'b');
    provider.seed('executed/sow_executed.pdf', 'c');
    provider.seed('executed/engagement_executed.docx', 'd');
    provider.seed('drafts/new_draft.docx', 'e');
    provider.seed('drafts/proposal.docx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.executed_marker.pattern).toBe('_executed');
    expect(config.executed_marker.location).toBe('before_extension');
  });

  it('detects (fully executed) parenthetical marker', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('contracts/NDA (fully executed).pdf', 'a');
    provider.seed('contracts/MSA (fully executed).pdf', 'b');
    provider.seed('contracts/SOW (fully executed).pdf', 'c');
    provider.seed('contracts/Amendment (fully executed).pdf', 'd');
    provider.seed('contracts/Template.docx', 'e');
    provider.seed('contracts/Draft.docx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.executed_marker.pattern).toBe('(fully executed)');
    expect(config.executed_marker.location).toBe('in_parentheses');
  });

  it('detects snake_case naming style', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('docs/company_nda_v2.docx', 'a');
    provider.seed('docs/partner_msa_final.docx', 'b');
    provider.seed('docs/vendor_agreement.docx', 'c');
    provider.seed('docs/equity_grant_notice.docx', 'd');
    provider.seed('docs/offer_letter_template.docx', 'e');
    provider.seed('docs/compliance_report.xlsx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.naming.style).toBe('snake_case');
  });

  it('detects kebab-case naming style', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('docs/company-nda-v2.docx', 'a');
    provider.seed('docs/partner-msa-final.docx', 'b');
    provider.seed('docs/vendor-agreement.docx', 'c');
    provider.seed('docs/equity-grant-notice.docx', 'd');
    provider.seed('docs/offer-letter-template.docx', 'e');
    provider.seed('docs/compliance-report.xlsx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.naming.style).toBe('kebab-case');
  });

  it('classifies asset-like folders separately', () => {
    const provider = new MemoryProvider('/test');
    provider.mkdir('Logos');
    provider.mkdir('Presentations');
    provider.mkdir('Vendor Agreements');
    provider.mkdir('Employment');
    // Need files for detection to kick in
    for (let i = 0; i < 6; i++) {
      provider.seed(`Vendor Agreements/doc_${i}.docx`, 'x');
    }
    const config = scanExistingConventions(provider);
    expect(config.lifecycle.asset_domains).toContain('Logos');
    expect(config.lifecycle.asset_domains).toContain('Presentations');
    expect(config.lifecycle.applicable_domains).toContain('Vendor Agreements');
    expect(config.lifecycle.applicable_domains).toContain('Employment');
  });
});

describe('convention-aware lint', () => {
  it('uses default marker when no conventions file exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-lint-conv-'));
    tempDirs.push(root);
    initializeWorkspace(root);
    const provider = new FilesystemProvider(root);

    // Write a file in executed/ without marker
    provider.writeFile('executed/unsigned.docx', 'data');

    const report = lintWorkspace(root, provider);
    expect(report.findings.some((f) => f.code === 'missing-executed-marker')).toBe(true);
  });

  it('uses custom marker from conventions config', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    // Override conventions to use _signed marker
    const config = loadConventions(provider);
    config.executed_marker.pattern = '_signed';
    writeConventions(provider, config);

    // File with _signed should NOT get missing-executed-marker
    provider.writeFile('executed/contract_signed.docx', 'data');
    // File without marker should get warning
    provider.writeFile('executed/contract.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const missingMarkerFindings = report.findings.filter((f) => f.code === 'missing-executed-marker');
    expect(missingMarkerFindings.length).toBe(1);
    expect(missingMarkerFindings[0].path).toBe('executed/contract.docx');
  });
});

describe('convention-aware indexer', () => {
  it('hasExecutedMarker accepts custom pattern', () => {
    expect(hasExecutedMarker('contract_signed.docx', '_signed')).toBe(true);
    expect(hasExecutedMarker('contract_executed.docx', '_signed')).toBe(false);
    expect(hasExecutedMarker('NDA (fully executed).pdf', '(fully executed)')).toBe(true);
  });
});

describe('init generates WORKSPACE.md and FOLDER.md', () => {
  it('creates documentation files on empty workspace', () => {
    const provider = new MemoryProvider('/test');
    const result = initializeWorkspace('/test', {}, provider);

    expect(result.createdFiles).toContain('WORKSPACE.md');
    expect(result.createdFiles).toContain('forms/FOLDER.md');
    expect(result.createdFiles).toContain('executed/FOLDER.md');

    const workspaceMd = provider.readTextFile('WORKSPACE.md');
    expect(workspaceMd).toContain('Workspace Overview');
    expect(workspaceMd).toContain('snake_case');

    const folderMd = provider.readTextFile('executed/FOLDER.md');
    expect(folderMd).toContain('executed/');
    expect(folderMd).toContain('Fully signed');
  });

  it('creates conventions.yaml during init', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    expect(provider.exists('.contracts-workspace/conventions.yaml')).toBe(true);
    const config = loadConventions(provider);
    expect(config.schema_version).toBe(1);
  });

  it('scans conventions on non-empty workspace', () => {
    const provider = new MemoryProvider('/test');
    // Pre-seed with snake_case files
    for (let i = 0; i < 6; i++) {
      provider.seed(`existing/contract_${i}.docx`, 'x');
    }

    initializeWorkspace('/test', {}, provider);
    const config = loadConventions(provider);
    expect(config.naming.style).toBe('snake_case');
  });
});

describe('backward compatibility', () => {
  it('existing tests still pass — init produces same lifecycle dirs', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-compat-'));
    tempDirs.push(root);

    const result = initializeWorkspace(root);
    expect(result.createdFiles).toContain('CONTRACTS.md');
    expect(result.createdFiles).toContain('forms-catalog.yaml');
    expect(result.createdDirectories).toContain('forms');
    expect(result.createdDirectories).toContain('drafts');
    expect(result.createdDirectories).toContain('incoming');
    expect(result.createdDirectories).toContain('executed');
    expect(result.createdDirectories).toContain('archive');
  });

  it('init is idempotent with conventions', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-idem-'));
    tempDirs.push(root);

    initializeWorkspace(root);
    const second = initializeWorkspace(root);

    expect(second.createdDirectories.length).toBe(0);
    expect(second.createdFiles.length).toBe(0);
  });
});

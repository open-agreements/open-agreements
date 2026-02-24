import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { defaultConventions, loadConventions, writeConventions } from '../src/core/convention-config.js';
import { scanExistingConventions } from '../src/core/convention-scanner.js';
import { FilesystemProvider } from '../src/core/filesystem-provider.js';
import { MemoryProvider } from '../src/core/memory-provider.js';
import { initializeWorkspace } from '../src/core/workspace-structure.js';
import { lintWorkspace } from '../src/core/lint.js';
import { hasExecutedMarker, hasPartiallyExecutedMarker, collectWorkspaceDocuments } from '../src/core/indexer.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Platform & Distribution');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('convention config', () => {
  it.openspec('OA-202')('defaultConventions returns valid config', () => {
    const config = defaultConventions();
    expect(config.schema_version).toBe(1);
    expect(config.executed_marker.pattern).toBe('_executed');
    expect(config.naming.style).toBe('snake_case');
    expect(config.lifecycle.applicable_domains).toContain('forms');
  });

  it.openspec('OA-202')('write and load round-trip with MemoryProvider', () => {
    const provider = new MemoryProvider('/test');
    const config = defaultConventions();
    config.naming.style = 'kebab-case';

    writeConventions(provider, config);
    const loaded = loadConventions(provider);
    expect(loaded.naming.style).toBe('kebab-case');
    expect(loaded.schema_version).toBe(1);
  });

  it.openspec('OA-202')('loadConventions returns defaults when file is missing', () => {
    const provider = new MemoryProvider('/test');
    const config = loadConventions(provider);
    expect(config).toEqual(defaultConventions());
  });

  it.openspec('OA-202')('write and load round-trip with FilesystemProvider', () => {
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
  it.openspec('OA-203')('returns defaults for empty workspace', () => {
    const provider = new MemoryProvider('/test');
    const config = scanExistingConventions(provider);
    expect(config).toEqual(defaultConventions());
  });

  it.openspec('OA-203')('returns defaults when fewer than 5 files exist', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('contracts/nda.docx', 'a');
    provider.seed('contracts/msa.docx', 'b');
    const config = scanExistingConventions(provider);
    expect(config.executed_marker.pattern).toBe('_executed');
  });

  it.openspec('OA-203')('detects _executed marker pattern from majority of files', () => {
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

  it.openspec('OA-203')('detects (fully executed) parenthetical marker', () => {
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

  it.openspec('OA-203')('detects snake_case naming style', () => {
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

  it.openspec('OA-203')('detects kebab-case naming style', () => {
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

  it.openspec('OA-203')('classifies asset-like folders separately', () => {
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
  it.openspec('OA-204')('uses default marker when no conventions file exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-lint-conv-'));
    tempDirs.push(root);
    initializeWorkspace(root);
    const provider = new FilesystemProvider(root);

    // Init no longer creates lifecycle dirs — create for this test
    provider.mkdir('executed');
    provider.writeFile('executed/unsigned.docx', 'data');

    const report = lintWorkspace(root, provider);
    expect(report.findings.some((f) => f.code === 'missing-executed-marker')).toBe(true);
  });

  it.openspec('OA-204')('uses custom marker from conventions config', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    // Override conventions to use _signed marker
    const config = loadConventions(provider);
    config.executed_marker.pattern = '_signed';
    writeConventions(provider, config);

    // File with _signed should NOT get missing-executed-marker
    provider.mkdir('executed');
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
  it.openspec('OA-205')('hasExecutedMarker accepts custom pattern', () => {
    expect(hasExecutedMarker('contract_signed.docx', '_signed')).toBe(true);
    expect(hasExecutedMarker('contract_executed.docx', '_signed')).toBe(false);
    expect(hasExecutedMarker('NDA (fully executed).pdf', '(fully executed)')).toBe(true);
  });
});

describe('init generates WORKSPACE.md and FOLDER.md', () => {
  it.openspec('OA-206')('creates documentation files on empty workspace', () => {
    const provider = new MemoryProvider('/test');
    const result = initializeWorkspace('/test', {}, provider);

    expect(result.createdFiles).toContain('WORKSPACE.md');
    // FOLDER.md only written inside lifecycle dirs that already exist
    expect(result.createdFiles).not.toContain('forms/FOLDER.md');

    const workspaceMd = provider.readTextFile('WORKSPACE.md');
    expect(workspaceMd).toContain('Workspace Overview');
    expect(workspaceMd).toContain('snake_case');

    // Verify FOLDER.md is written when lifecycle dir exists
    provider.mkdir('executed');
    const result2 = initializeWorkspace('/test', {}, provider);
    expect(result2.createdFiles).toContain('executed/FOLDER.md');
    const folderMd = provider.readTextFile('executed/FOLDER.md');
    expect(folderMd).toContain('executed/');
    expect(folderMd).toContain('Fully signed');
  });

  it.openspec('OA-206')('creates conventions.yaml during init', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    expect(provider.exists('.contracts-workspace/conventions.yaml')).toBe(true);
    const config = loadConventions(provider);
    expect(config.schema_version).toBe(1);
  });

  it.openspec('OA-206')('scans conventions on non-empty workspace', () => {
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

describe('partially_executed marker detection', () => {
  it.openspec('OA-207')('hasPartiallyExecutedMarker detects _partially_executed suffix', () => {
    expect(hasPartiallyExecutedMarker('nda_partially_executed.docx')).toBe(true);
    expect(hasPartiallyExecutedMarker('nda_executed.docx')).toBe(false);
    expect(hasPartiallyExecutedMarker('nda.docx')).toBe(false);
  });

  it.openspec('OA-207')('hasExecutedMarker returns false for _partially_executed files', () => {
    expect(hasExecutedMarker('nda_partially_executed.docx')).toBe(false);
    expect(hasExecutedMarker('nda_executed.docx')).toBe(true);
  });

  it.openspec('OA-207')('collectWorkspaceDocuments assigns partially_executed status', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    provider.mkdir('executed');
    provider.mkdir('drafts');
    provider.writeFile('executed/nda_executed.docx', 'data');
    provider.writeFile('executed/msa_partially_executed.docx', 'data');
    provider.writeFile('drafts/draft.docx', 'data');

    const docs = collectWorkspaceDocuments('/test', provider);
    const executed = docs.find((d) => d.file_name === 'nda_executed.docx')!;
    const partial = docs.find((d) => d.file_name === 'msa_partially_executed.docx')!;
    const pending = docs.find((d) => d.file_name === 'draft.docx')!;

    expect(executed.status).toBe('executed');
    expect(executed.executed).toBe(true);
    expect(executed.partially_executed).toBe(false);

    expect(partial.status).toBe('partially_executed');
    expect(partial.executed).toBe(false);
    expect(partial.partially_executed).toBe(true);

    expect(pending.status).toBe('pending');
    expect(pending.executed).toBe(false);
    expect(pending.partially_executed).toBe(false);
  });

  it.openspec('OA-207')('lint does not warn about missing marker for partially_executed files in executed/', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    provider.mkdir('executed');
    provider.writeFile('executed/nda_partially_executed.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const missingMarker = report.findings.filter((f) => f.code === 'missing-executed-marker');
    expect(missingMarker.length).toBe(0);
  });

  it.openspec('OA-207')('scanner detects _partially_executed as a distinct candidate', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('contracts/nda_partially_executed.docx', 'a');
    provider.seed('contracts/msa_partially_executed.docx', 'b');
    provider.seed('contracts/sow_partially_executed.pdf', 'c');
    provider.seed('contracts/engagement_partially_executed.docx', 'd');
    provider.seed('contracts/template.docx', 'e');
    provider.seed('contracts/draft.docx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.executed_marker.pattern).toBe('_partially_executed');
    expect(config.executed_marker.location).toBe('before_extension');
  });
});

describe('title-case-spaces naming detection', () => {
  it.openspec('OA-203')('detects Title Case With Spaces naming style', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('docs/Board Meeting Minutes.docx', 'a');
    provider.seed('docs/Employee Offer Letter.docx', 'b');
    provider.seed('docs/Vendor Agreement Template.docx', 'c');
    provider.seed('docs/Stock Purchase Agreement.pdf', 'd');
    provider.seed('docs/Confidentiality Agreement.docx', 'e');
    provider.seed('docs/Consulting Services Agreement.docx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.naming.style).toBe('title-case-spaces');
    expect(config.naming.separator).toBe(' ');
  });

  it.openspec('OA-203')('does not detect title-case-spaces when files have dash separators', () => {
    const provider = new MemoryProvider('/test');
    provider.seed('docs/NDA - Acme Corp.docx', 'a');
    provider.seed('docs/MSA - Partner Inc.docx', 'b');
    provider.seed('docs/SOW - Client LLC.docx', 'c');
    provider.seed('docs/Amendment - Vendor Co.pdf', 'd');
    provider.seed('docs/Template - Standard.docx', 'e');
    provider.seed('docs/Draft - Review.docx', 'f');
    const config = scanExistingConventions(provider);
    expect(config.naming.style).toBe('title-case-dash');
  });
});

describe('duplicate-file lint rule', () => {
  it.openspec('OA-208')('detects copy-pattern duplicates', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    provider.mkdir('drafts');
    provider.writeFile('drafts/contract.docx', 'data');
    provider.writeFile('drafts/contract (1).docx', 'data');

    const report = lintWorkspace('/test', provider);
    const dups = report.findings.filter((f) => f.code === 'duplicate-file');
    expect(dups.length).toBe(2);
  });

  it.openspec('OA-208')('detects timestamp-suffixed duplicates', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    provider.mkdir('incoming');
    provider.writeFile('incoming/report.pdf', 'data');
    provider.writeFile('incoming/report - 2024-01-15.pdf', 'data');

    const report = lintWorkspace('/test', provider);
    const dups = report.findings.filter((f) => f.code === 'duplicate-file');
    expect(dups.length).toBe(2);
  });

  it.openspec('OA-208')('does not flag unrelated files as duplicates', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    provider.mkdir('drafts');
    provider.writeFile('drafts/nda.docx', 'data');
    provider.writeFile('drafts/msa.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const dups = report.findings.filter((f) => f.code === 'duplicate-file');
    expect(dups.length).toBe(0);
  });
});

describe('root-orphan lint rule', () => {
  it.openspec('OA-209')('warns about files at workspace root', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    provider.writeFile('stray_document.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const orphans = report.findings.filter((f) => f.code === 'root-orphan');
    expect(orphans.length).toBe(1);
    expect(orphans[0].path).toBe('stray_document.docx');
  });

  it.openspec('OA-209')('does not warn about known config files', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    // These are created by init and should not be flagged
    const report = lintWorkspace('/test', provider);
    const orphans = report.findings.filter((f) => f.code === 'root-orphan');
    expect(orphans.length).toBe(0);
  });
});

describe('cross-contamination lint rule', () => {
  it.openspec('OA-210')('warns when a high-confidence compound phrase suggests wrong domain folder', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    // Configure applicable_domains to include domain folders
    const config = loadConventions(provider);
    config.lifecycle.applicable_domains = ['Board Meetings', 'Sales', 'Employment'];
    writeConventions(provider, config);

    // An offer letter sitting in Board Meetings — "offer letter" is a high-confidence Employment phrase
    provider.mkdir('Board Meetings');
    provider.seed('Board Meetings/2025 Offer Letter - Jane Doe.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const crossFindings = report.findings.filter((f) => f.code === 'cross-contamination');
    expect(crossFindings.length).toBe(1);
    expect(crossFindings[0].message).toContain('Employment');
  });

  it.openspec('OA-210')('does not flag generic terms like agreement or policy', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    const config = loadConventions(provider);
    config.lifecycle.applicable_domains = ['Board Meetings', 'Sales'];
    writeConventions(provider, config);

    // "Agreement" is generic — should NOT be flagged
    provider.mkdir('Board Meetings');
    provider.seed('Board Meetings/Shareholders Agreement.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const crossFindings = report.findings.filter((f) => f.code === 'cross-contamination');
    expect(crossFindings.length).toBe(0);
  });

  it.openspec('OA-210')('does not run when no non-lifecycle domain folders are configured', () => {
    const provider = new MemoryProvider('/test');
    initializeWorkspace('/test', {}, provider);

    // Default conventions only have lifecycle dirs as applicable_domains
    provider.mkdir('drafts');
    provider.writeFile('drafts/employment_offer.docx', 'data');

    const report = lintWorkspace('/test', provider);
    const crossFindings = report.findings.filter((f) => f.code === 'cross-contamination');
    expect(crossFindings.length).toBe(0);
  });
});

describe('backward compatibility', () => {
  it.openspec('OA-211')('init creates config files but not lifecycle directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-compat-'));
    tempDirs.push(root);

    const result = initializeWorkspace(root);
    expect(result.createdFiles).toContain('CONTRACTS.md');
    expect(result.createdFiles).toContain('forms-catalog.yaml');
    // Lifecycle dirs are not auto-created — lint suggests them instead
    expect(result.createdDirectories).not.toContain('forms');
    expect(result.createdDirectories).not.toContain('executed');
  });

  it.openspec('OA-211')('init is idempotent with conventions', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-idem-'));
    tempDirs.push(root);

    initializeWorkspace(root);
    const second = initializeWorkspace(root);

    expect(second.createdDirectories.length).toBe(0);
    expect(second.createdFiles.length).toBe(0);
  });
});

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_TEMPLATE_IDS,
  JSON_SPEC_TEMPLATE_IDS,
  NON_PREFIX_OA_TEMPLATE_IDS,
  SHARED_RENDERER_TEMPLATE_IDS,
  expandTriggers,
  findManifestSatisfied,
  findMissingFreshness,
  parseChangedFiles,
} from '../scripts/check_preview_freshness.mjs';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts', 'check_preview_freshness.mjs');

// Mirror the canonical OA-owned template inventory at HEAD. Tests build their
// own `headOwnedIds` rather than calling listOpenAgreementsTemplateIds() so
// they don't depend on the actual content/templates/ tree at test time.
const HEAD_OA_TEMPLATE_IDS = new Set<string>([
  ...CANONICAL_TEMPLATE_IDS,
  ...JSON_SPEC_TEMPLATE_IDS,
  ...NON_PREFIX_OA_TEMPLATE_IDS,
  'openagreements-due-diligence-request-list',
]);

function runRule(
  records: Array<{ status: string; path: string; previousPath?: string | null }>,
  ownedAtHead: Set<string> = HEAD_OA_TEMPLATE_IDS,
) {
  const normalized = parseChangedFiles(JSON.stringify(records));
  const triggered = expandTriggers(normalized, ownedAtHead);
  const missing = findMissingFreshness(normalized, triggered);
  return { triggered: new Set(triggered.keys()), missing: new Set(missing) };
}

// ── Per-template render-input rules (§3c) ────────────────────────────────────

describe('per-template render-input rules', () => {
  it('canonical template.md change without preview → missing', () => {
    const { missing } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-employment-offer-letter/template.md' },
    ]);
    expect(missing).toEqual(new Set(['openagreements-employment-offer-letter']));
  });

  it('canonical template.md change WITH matching preview → not missing', () => {
    const { missing } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-employment-offer-letter/template.md' },
      { status: 'modified', path: 'site/assets/previews/openagreements-employment-offer-letter/page-1.png' },
    ]);
    expect(missing.size).toBe(0);
  });

  it('zero-padded preview page (page-01.png) also satisfies', () => {
    const { missing } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-due-diligence-request-list/template.docx' },
      { status: 'modified', path: 'site/assets/previews/openagreements-due-diligence-request-list/page-01.png' },
    ]);
    expect(missing.size).toBe(0);
  });

  it('template.md change on a non-canonical template (e.g., due-diligence) → no trigger', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-due-diligence-request-list/template.md' },
    ]);
    expect(triggered.size).toBe(0);
  });

  it('template.md change on closing-checklist (non-canonical, docs only) → no trigger', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'content/templates/closing-checklist/template.md' },
    ]);
    expect(triggered.size).toBe(0);
  });

  it('template.json on the JSON-spec template without preview → missing', () => {
    const { missing } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-employment-confidentiality-acknowledgement/template.json' },
    ]);
    expect(missing).toEqual(new Set(['openagreements-employment-confidentiality-acknowledgement']));
  });

  it('template.docx change on any OA-owned template → missing', () => {
    const { missing } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-board-consent-safe/template.docx' },
    ]);
    expect(missing).toEqual(new Set(['openagreements-board-consent-safe']));
  });

  it('metadata.yaml change on any OA-owned template → no trigger (catalog-only)', () => {
    for (const id of HEAD_OA_TEMPLATE_IDS) {
      const { triggered } = runRule([
        { status: 'modified', path: `content/templates/${id}/metadata.yaml` },
      ]);
      expect(triggered.size, `metadata.yaml on ${id} should not trigger`).toBe(0);
    }
  });

  it('README/practice-note/reference-source/.template.generated.json → no trigger', () => {
    for (const file of ['README.md', 'practice-note.md', 'reference-source.docx', '.template.generated.json']) {
      const { triggered } = runRule([
        { status: 'modified', path: `content/templates/openagreements-employment-offer-letter/${file}` },
      ]);
      expect(triggered.size, `${file} should not trigger`).toBe(0);
    }
  });

  it('non-OA template edit (e.g., Common Paper) → no trigger', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'content/templates/common-paper-mutual-nda/template.docx' },
    ]);
    expect(triggered.size).toBe(0);
  });
});

// ── Generator-family triggers (§3d) ──────────────────────────────────────────

describe('generator-family invalidation', () => {
  it('scripts/generate_templates.mjs → all 6 SHARED_RENDERER templates', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/generate_templates.mjs' },
    ]);
    expect(triggered).toEqual(SHARED_RENDERER_TEMPLATE_IDS);
  });

  it('scripts/template_renderer/canonical-source.mjs → all 6 SHARED_RENDERER templates', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/template_renderer/canonical-source.mjs' },
    ]);
    expect(triggered).toEqual(SHARED_RENDERER_TEMPLATE_IDS);
  });

  it('cover-standard-signature-v1 layout → 4 cover-layout templates', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/template_renderer/layouts/cover-standard-signature-v1.mjs' },
    ]);
    expect(triggered).toEqual(new Set([
      'openagreements-employment-offer-letter',
      'openagreements-employee-ip-inventions-assignment',
      'openagreements-employment-confidentiality-acknowledgement',
      'openagreements-restrictive-covenant-wyoming',
    ]));
  });

  it('traditional-consent-v1 layout → both SAFE consents', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/template_renderer/layouts/traditional-consent-v1.mjs' },
    ]);
    expect(triggered).toEqual(new Set([
      'openagreements-board-consent-safe',
      'openagreements-stockholder-consent-safe',
    ]));
  });

  it('shared style → 8 templates (6 SHARED_RENDERER + closing-checklist + working-group-list)', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/template-specs/styles/openagreements-default-v1.json' },
    ]);
    expect(triggered).toEqual(new Set([
      ...SHARED_RENDERER_TEMPLATE_IDS,
      'closing-checklist',
      'working-group-list',
    ]));
    expect(triggered.has('openagreements-due-diligence-request-list')).toBe(false);
  });

  it('checklist generator → closing-checklist only', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/generate_checklist_template.mjs' },
    ]);
    expect(triggered).toEqual(new Set(['closing-checklist']));
  });

  it('working-group generator → working-group-list only', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/generate_working_group_template.mjs' },
    ]);
    expect(triggered).toEqual(new Set(['working-group-list']));
  });

  it('preview pipeline change → all OA-owned templates (dynamic)', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/render_docx_pages.mjs' },
    ]);
    expect(triggered).toEqual(HEAD_OA_TEMPLATE_IDS);
  });

  it('libreoffice_headless.mjs change → all OA-owned templates', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/libreoffice_headless.mjs' },
    ]);
    expect(triggered).toEqual(HEAD_OA_TEMPLATE_IDS);
  });

  it('generate_template_previews.mjs (orchestrator) change → no trigger (refactor-safe)', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/generate_template_previews.mjs' },
    ]);
    expect(triggered.size).toBe(0);
  });

  it('legacy libreoffice script → no trigger', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/generate_employment_templates_libreoffice.mjs' },
    ]);
    expect(triggered.size).toBe(0);
  });

  it('legacy aspose script → no trigger', () => {
    const { triggered } = runRule([
      { status: 'modified', path: 'scripts/aspose_style_employment_templates.py' },
    ]);
    expect(triggered.size).toBe(0);
  });
});

// ── Ownership + rename + deletion ────────────────────────────────────────────

describe('ownership / rename / deletion', () => {
  it.each(['closing-checklist', 'working-group-list'])(
    'deletion of non-prefix OA template %s without preview deletion → missing',
    (id) => {
      const { missing } = runRule([
        { status: 'removed', path: `content/templates/${id}/template.docx` },
      ]);
      expect(missing).toEqual(new Set([id]));
    },
  );

  it('deletion of closing-checklist WITH matching preview deletion → not missing', () => {
    const { missing } = runRule([
      { status: 'removed', path: 'content/templates/closing-checklist/template.docx' },
      { status: 'removed', path: 'site/assets/previews/closing-checklist/page-1.png' },
    ]);
    expect(missing.size).toBe(0);
  });

  it('full template + preview folder deletion together → not missing', () => {
    const { missing } = runRule([
      { status: 'removed', path: 'content/templates/openagreements-board-consent-safe/template.md' },
      { status: 'removed', path: 'content/templates/openagreements-board-consent-safe/template.docx' },
      { status: 'removed', path: 'site/assets/previews/openagreements-board-consent-safe/page-1.png' },
      { status: 'removed', path: 'site/assets/previews/openagreements-board-consent-safe/page-2.png' },
    ]);
    expect(missing.size).toBe(0);
  });

  it('new OA-owned template added without previews → missing', () => {
    const { missing } = runRule([
      { status: 'added', path: 'content/templates/openagreements-employment-offer-letter/template.docx' },
    ]);
    expect(missing).toEqual(new Set(['openagreements-employment-offer-letter']));
  });

  it('paired template.md + preview rename → not missing', () => {
    const { missing } = runRule([
      {
        status: 'renamed',
        path: 'content/templates/openagreements-employment-offer-letter/template.md',
        previousPath: 'content/templates/openagreements-employment-offer-letter-old/template.md',
      },
      {
        status: 'renamed',
        path: 'site/assets/previews/openagreements-employment-offer-letter/page-1.png',
        previousPath: 'site/assets/previews/openagreements-employment-offer-letter-old/page-1.png',
      },
    ]);
    expect(missing.size).toBe(0);
  });

  it('template rename WITHOUT preview rename → missing (preview not moved)', () => {
    const { missing } = runRule([
      {
        status: 'renamed',
        path: 'content/templates/openagreements-employment-offer-letter/template.md',
        previousPath: 'content/templates/openagreements-employment-offer-letter-old/template.md',
      },
    ]);
    // Only the previous id is in CANONICAL_TEMPLATE_IDS as a known canonical
    // template; the new id isn't, so only the old-side requirement remains
    // unsatisfied.
    expect(missing.size).toBeGreaterThan(0);
  });
});

// ── Wire format parsing ──────────────────────────────────────────────────────

describe('parseChangedFiles', () => {
  it('parses JSON input', () => {
    const out = parseChangedFiles(JSON.stringify([
      { status: 'modified', path: 'a.md' },
    ]));
    expect(out).toEqual([{ status: 'modified', path: 'a.md' }]);
  });

  it('parses `git diff --name-status -z` byte stream', () => {
    const z = 'M\0a.md\0D\0b.md\0';
    const out = parseChangedFiles(z);
    expect(out).toEqual([
      { status: 'modified', path: 'a.md' },
      { status: 'removed', path: 'b.md' },
    ]);
  });

  it('normalizes renames to delete+add pair', () => {
    const z = 'R100\0old/path\0new/path\0';
    const out = parseChangedFiles(z);
    expect(out).toEqual([
      { status: 'removed', path: 'old/path' },
      { status: 'added', path: 'new/path' },
    ]);
  });

  it('handles GitHub "renamed" status with previousPath', () => {
    const out = parseChangedFiles(JSON.stringify([
      { status: 'renamed', path: 'new/x', previousPath: 'old/x' },
    ]));
    expect(out).toEqual([
      { status: 'removed', path: 'old/x' },
      { status: 'added', path: 'new/x' },
    ]);
  });

  it('treats empty input as no records', () => {
    expect(parseChangedFiles('')).toEqual([]);
    expect(parseChangedFiles('   ')).toEqual([]);
    expect(parseChangedFiles('[]')).toEqual([]);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseChangedFiles('[not json')).toThrow(/not valid JSON/);
  });
});

// ── Manifest satisfaction ───────────────────────────────────────────────────

describe('manifest satisfaction', () => {
  it('satisfies a triggered template when the manifest SHA matches template.docx', () => {
    const result = findManifestSatisfied(['openagreements-employment-offer-letter'], REPO_ROOT, [
      {
        templateId: 'openagreements-employment-offer-letter',
        docxSha256: '2cceb36a2e5a45af97f9bda244b994f44d2290deba97188b2b9a13e99c44595b',
        reason: 'test byte-identical render claim',
      },
    ]);

    expect(result.satisfied).toEqual(new Set(['openagreements-employment-offer-letter']));
    expect(result.stale).toEqual([]);
  });

  it('reports stale entries when the manifest SHA no longer matches template.docx', () => {
    const result = findManifestSatisfied(['openagreements-employment-offer-letter'], REPO_ROOT, [
      {
        templateId: 'openagreements-employment-offer-letter',
        docxSha256: '0000000000000000000000000000000000000000000000000000000000000000',
        reason: 'test stale claim',
      },
    ]);

    expect(result.satisfied.size).toBe(0);
    expect(result.stale).toEqual([
      {
        templateId: 'openagreements-employment-offer-letter',
        declaredSha: '0000000000000000000000000000000000000000000000000000000000000000',
        currentSha: '2cceb36a2e5a45af97f9bda244b994f44d2290deba97188b2b9a13e99c44595b',
      },
    ]);
  });
});

// ── CLI smoke test ───────────────────────────────────────────────────────────

describe('CLI main-guard', () => {
  it('exits 1 on a template.md change without preview', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'modified',
            path: 'content/templates/openagreements-employment-offer-letter/template.md',
            previousPath: null,
          },
        ]),
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/openagreements-employment-offer-letter/);
    expect(result.stderr).toMatch(/::error file=content\/templates\/openagreements-employment-offer-letter\/template\.md/);
  });

  it('exits 0 on a clean diff (only README touched)', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'modified',
            path: 'content/templates/openagreements-employment-offer-letter/README.md',
            previousPath: null,
          },
        ]),
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/PASS preview-freshness/);
  });

  it('exits 0 on a docx change covered by a matching manifest entry', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'modified',
            path: 'content/templates/openagreements-employment-offer-letter/template.docx',
            previousPath: null,
          },
        ]),
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/1 template\(s\) satisfied via manifest/);
  });

  it('exits 1 on empty OA_CHANGED_FILES with OA_GATE_REQUIRE_INPUT=1', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: '',
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/OA_CHANGED_FILES/);
  });

  it('exits 0 with skip message when no base ref is available locally', () => {
    const env = { ...process.env };
    delete env.OA_CHANGED_FILES;
    delete env.OA_GATE_REQUIRE_INPUT;
    env.OA_LOCAL_BASE_REF = 'definitely-not-a-real-ref-xyzzy';
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/skipped:/);
  });
});

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CANONICAL_TEMPLATE_IDS,
  JSON_SPEC_TEMPLATE_IDS,
  NON_PREFIX_OA_TEMPLATE_IDS,
  SHARED_RENDERER_TEMPLATE_IDS,
  expandTriggers,
  findManifestSatisfied,
  findMissingFreshness,
  loadPreviewFreshnessManifest,
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
      { status: 'modified', path: 'content/templates/openagreements-board-consent-safe/template.md' },
    ]);
    expect(missing).toEqual(new Set(['openagreements-board-consent-safe']));
  });

  it('canonical template.md change WITH matching preview → not missing', () => {
    const { missing } = runRule([
      { status: 'modified', path: 'content/templates/openagreements-board-consent-safe/template.md' },
      { status: 'modified', path: 'site/assets/previews/openagreements-board-consent-safe/page-1.png' },
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

  // NOTE: the upstream-authored exemption (a `template.mdoc` dir is skipped by
  // the freshness gate) is exercised end-to-end by the upstream-sync's own CI,
  // where real templates carry `template.mdoc`. It is intentionally not asserted
  // here with a synthetic fixture: that would require writing a temporary
  // template dir under content/templates, which races OA's parallel suites.

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
        { status: 'modified', path: `content/templates/openagreements-board-consent-safe/${file}` },
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
      { status: 'added', path: 'content/templates/openagreements-due-diligence-request-list/template.docx' },
    ]);
    expect(missing).toEqual(new Set(['openagreements-due-diligence-request-list']));
  });

  it('paired template.md + preview rename → not missing', () => {
    const { missing } = runRule([
      {
        status: 'renamed',
        path: 'content/templates/openagreements-board-consent-safe/template.md',
        previousPath: 'content/templates/openagreements-board-consent-safe-old/template.md',
      },
      {
        status: 'renamed',
        path: 'site/assets/previews/openagreements-board-consent-safe/page-1.png',
        previousPath: 'site/assets/previews/openagreements-board-consent-safe-old/page-1.png',
      },
    ]);
    expect(missing.size).toBe(0);
  });

  it('template rename WITHOUT preview rename → missing (preview not moved)', () => {
    const { missing } = runRule([
      {
        status: 'renamed',
        path: 'content/templates/openagreements-board-consent-safe/template.md',
        previousPath: 'content/templates/openagreements-board-consent-safe-old/template.md',
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

// ── Manifest loader validation ──────────────────────────────────────────────

describe('loadPreviewFreshnessManifest validation', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
  });

  function fakeRepo(manifestBody: unknown): string {
    const dir = mkdtempSync(join(tmpdir(), 'oa-pf-manifest-'));
    tempDirs.push(dir);
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(
      join(dir, 'scripts', 'preview-freshness-manifest.json'),
      typeof manifestBody === 'string' ? manifestBody : JSON.stringify(manifestBody),
    );
    return dir;
  }

  it('rejects non-hex docxSha256 values', () => {
    const repo = fakeRepo({
      entries: [{ templateId: 'foo', docxSha256: 'not-a-sha', reason: 'x' }],
    });
    expect(() => loadPreviewFreshnessManifest(repo)).toThrow(/invalid docxSha256/);
  });

  it('rejects the (missing) sentinel as a docxSha256 value', () => {
    const repo = fakeRepo({
      entries: [{ templateId: 'foo', docxSha256: '(missing)', reason: 'deletion bypass attempt' }],
    });
    expect(() => loadPreviewFreshnessManifest(repo)).toThrow(/invalid docxSha256/);
  });

  it('rejects SHA values with the wrong length', () => {
    const repo = fakeRepo({
      entries: [{ templateId: 'foo', docxSha256: 'aabb', reason: 'too short' }],
    });
    expect(() => loadPreviewFreshnessManifest(repo)).toThrow(/invalid docxSha256/);
  });

  it('rejects duplicate templateId entries', () => {
    const repo = fakeRepo({
      entries: [
        { templateId: 'foo', docxSha256: 'a'.repeat(64), reason: 'first' },
        { templateId: 'foo', docxSha256: 'b'.repeat(64), reason: 'second hides first' },
      ],
    });
    expect(() => loadPreviewFreshnessManifest(repo)).toThrow(/duplicate templateId/);
  });

  it('rejects non-object entries (string, array, null)', () => {
    expect(() => loadPreviewFreshnessManifest(fakeRepo({ entries: ['hello'] }))).toThrow(
      /must be an object/,
    );
    expect(() => loadPreviewFreshnessManifest(fakeRepo({ entries: [['a']] }))).toThrow(
      /must be an object/,
    );
    expect(() => loadPreviewFreshnessManifest(fakeRepo({ entries: [null] }))).toThrow(
      /must be an object/,
    );
  });

  it('accepts a valid 64-char lowercase hex SHA', () => {
    const repo = fakeRepo({
      entries: [{ templateId: 'foo', docxSha256: 'a'.repeat(64), reason: 'ok' }],
    });
    expect(() => loadPreviewFreshnessManifest(repo)).not.toThrow();
  });

  it('returns [] when the manifest file is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-pf-manifest-absent-'));
    tempDirs.push(dir);
    expect(loadPreviewFreshnessManifest(dir)).toEqual([]);
  });
});

// ── Manifest satisfaction ───────────────────────────────────────────────────

describe('manifest satisfaction', () => {
  it('satisfies a triggered template when the manifest SHA matches template.docx', () => {
    const result = findManifestSatisfied(['openagreements-board-consent-safe'], REPO_ROOT, [
      {
        templateId: 'openagreements-board-consent-safe',
        docxSha256: '79b92e64648c453f512f2cb013af33e17bd12f61561fc420771a6b2351d51185',
        reason: 'test byte-identical render claim',
      },
    ]);

    expect(result.satisfied).toEqual(new Set(['openagreements-board-consent-safe']));
    expect(result.stale).toEqual([]);
  });

  it('reports stale entries when the manifest SHA no longer matches template.docx', () => {
    const result = findManifestSatisfied(['openagreements-board-consent-safe'], REPO_ROOT, [
      {
        templateId: 'openagreements-board-consent-safe',
        docxSha256: '0000000000000000000000000000000000000000000000000000000000000000',
        reason: 'test stale claim',
      },
    ]);

    expect(result.satisfied.size).toBe(0);
    expect(result.stale).toEqual([
      {
        templateId: 'openagreements-board-consent-safe',
        declaredSha: '0000000000000000000000000000000000000000000000000000000000000000',
        currentSha: '79b92e64648c453f512f2cb013af33e17bd12f61561fc420771a6b2351d51185',
      },
    ]);
  });

  it('flags a manifest entry as stale (not satisfied) when template.docx is missing on disk', () => {
    const result = findManifestSatisfied(['template-that-does-not-exist'], REPO_ROOT, [
      {
        templateId: 'template-that-does-not-exist',
        docxSha256: '0000000000000000000000000000000000000000000000000000000000000000',
        reason: 'deletion-bypass guard',
      },
    ]);
    expect(result.satisfied.size).toBe(0);
    expect(result.stale).toEqual([
      {
        templateId: 'template-that-does-not-exist',
        declaredSha: '0000000000000000000000000000000000000000000000000000000000000000',
        currentSha: '(template.docx missing on disk)',
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
            path: 'content/templates/openagreements-board-consent-safe/template.md',
            previousPath: null,
          },
        ]),
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/openagreements-board-consent-safe/);
    expect(result.stderr).toMatch(/::error file=content\/templates\/openagreements-board-consent-safe\/template\.md/);
  });

  it('exits 0 on a clean diff (only README touched)', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'modified',
            path: 'content/templates/openagreements-board-consent-safe/README.md',
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

  it('exits 1 when template.docx is ADDED (manifest cannot vouch for byte-identity vs nonexistent baseline)', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'added',
            path: 'content/templates/openagreements-due-diligence-request-list/template.docx',
            previousPath: null,
          },
        ]),
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toMatch(/satisfied via manifest/);
    expect(result.stderr).toMatch(/openagreements-due-diligence-request-list/);
  });

  it("'freshness/skip' label bypasses the gate even when manifest validation would fail", () => {
    // A stale manifest entry would normally hard-fail. Asserts the label
    // short-circuit fires BEFORE manifest loading, so the bypass is total —
    // not conditional on manifest validity. Documents the precedence policy
    // for future maintainers.
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_PR_LABELS: 'freshness/skip',
        // Empty OA_CHANGED_FILES would fail with OA_GATE_REQUIRE_INPUT=1, but
        // the label short-circuit fires before that check too.
        OA_CHANGED_FILES: '',
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/freshness\/skip/);
    expect(result.stdout).toMatch(/explicitly bypassed/);
  });

  it('exits 1 when docx AND template.md change together (manifest cannot shield source-side change)', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'modified',
            path: 'content/templates/openagreements-board-consent-safe/template.docx',
            previousPath: null,
          },
          {
            status: 'modified',
            path: 'content/templates/openagreements-board-consent-safe/template.md',
            previousPath: null,
          },
        ]),
        OA_GATE_REQUIRE_INPUT: '1',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/openagreements-board-consent-safe/);
    expect(result.stdout).not.toMatch(/satisfied via manifest/);
  });

  it('exits 0 on a docx change covered by a matching manifest entry', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OA_CHANGED_FILES: JSON.stringify([
          {
            status: 'modified',
            path: 'content/templates/openagreements-board-consent-safe/template.docx',
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

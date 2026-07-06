/**
 * End-to-end smoke test: fill every Common Paper template with realistic
 * field values (all fields populated, all booleans true) and verify the
 * output DOCX has no unrendered tags or formatting errors.
 *
 * Fixture data lives in integration-tests/fixtures/smoke-test-data/<template-id>.json
 */
import { readdirSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { itAllure } from './helpers/allure-test.js';
import { seconds } from './helpers/timeouts.js';
import { fillTemplate } from '../src/core/engine.js';
import { verifyTemplateFill } from '../src/core/fill-utils.js';
import { findTemplateDir, resolveTemplateDir } from '../src/utils/paths.js';

const it = itAllure.epic('Filling & Rendering');

// Every slug lives two levels deep as templates/<source>-<rights>/<slug>/; resolve
// via the metadata-derived index instead of hard-coding the segment.
const FIXTURES_DIR = resolve(__dirname, 'fixtures/smoke-test-data');
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Collect temp dirs for cleanup
const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Discover all fixture files → template IDs
const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

// Only test templates that actually exist in templates
const testCases = fixtureFiles.filter((id) => {
  const dir = findTemplateDir(id);
  return dir !== undefined && existsSync(join(dir, 'template.docx'));
});

/**
 * A template is manual-fill-only when the document the engine will consume —
 * `template.fill.docx` when present (#1378 dual-artifact), else
 * `template.docx` — carries zero fill tokens (humanized bracket prose).
 * Derived from the template dir instead of a hardcoded list so the smoke
 * stays correct as upstream syncs add machine-fillable twins: a token-less
 * doc must come back unchanged WITH the guardrail warning, and a
 * token-bearing doc must actually consume fields.
 */
function isManualFillOnly(templateDir: string): boolean {
  const fillVariant = join(templateDir, 'template.fill.docx');
  const docPath = existsSync(fillVariant) ? fillVariant : join(templateDir, 'template.docx');
  const xml = new AdmZip(docPath).getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  // Reassemble text per paragraph (tokens may split across runs, never across
  // paragraphs) — same shape as validateTemplate's token sniff.
  const paragraphs = [...xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) =>
    [...p[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join('')
  );
  return !paragraphs.some((text) => /\{(?:IF |FOR |END|\$|\w+\})/.test(text));
}

describe('E2E smoke test — fill all templates with complete field data', () => {
  it.each(testCases)(
    '%s fills cleanly with all fields populated',
    async (templateId) => {
      const templateDir = resolveTemplateDir(templateId);
      const fixtureData = JSON.parse(
        readFileSync(join(FIXTURES_DIR, `${templateId}.json`), 'utf-8')
      ) as Record<string, unknown>;

      const tempDir = mkdtempSync(join(tmpdir(), `smoke-${templateId}-`));
      tempDirs.push(tempDir);
      const outputPath = join(tempDir, `${templateId}-filled.docx`);

      // Fill template through the full pipeline (clean → patch → selections → fill)
      const result = await fillTemplate({ templateDir, values: fixtureData, outputPath });

      // 0. Fill-truthfulness guardrail (issues #579/#580): token-less
      // manual-fill documents must say so; token-bearing templates must
      // actually consume fields and carry no zero-command warning.
      const zeroCommandWarnings = result.warnings.filter((w) =>
        w.includes('no machine-fillable fields')
      );
      if (isManualFillOnly(templateDir)) {
        expect(result.fillCommandCount, `${templateId}: expected token-less docx`).toBe(0);
        expect(result.fieldsUsed, `${templateId}: nothing can be used`).toEqual([]);
        expect(zeroCommandWarnings, `${templateId}: missing unchanged-document warning`).toHaveLength(1);
      } else {
        expect(result.fillCommandCount, `${templateId}: expected fill commands`).toBeGreaterThan(0);
        expect(result.providedFieldsUsed.length, `${templateId}: no provided fields consumed`).toBeGreaterThan(0);
        expect(zeroCommandWarnings, `${templateId}: unexpected zero-command warning`).toHaveLength(0);
      }

      // 1. Output file exists and is non-empty
      const outputBuffer = readFileSync(outputPath);
      expect(outputBuffer.length, `${templateId}: output is empty`).toBeGreaterThan(0);

      // 2. Output is a valid ZIP/DOCX
      const zip = new AdmZip(outputPath);
      const docEntry = zip.getEntry('word/document.xml');
      expect(docEntry, `${templateId}: missing word/document.xml`).toBeDefined();

      // 3. Run verifyTemplateFill (checks for double $$ and unrendered {tags})
      const verify = verifyTemplateFill(outputPath);
      for (const check of verify.checks) {
        expect(check.passed, `${templateId}: ${check.name} — ${check.details ?? ''}`).toBe(true);
      }

      // 4. No IF/END-IF conditional blocks remaining
      const allXml: string[] = [];
      for (const entry of zip.getEntries()) {
        if (entry.entryName.startsWith('word/') && entry.entryName.endsWith('.xml')) {
          allXml.push(entry.getData().toString('utf-8'));
        }
      }
      const fullXml = allXml.join('\n');
      expect(fullXml, `${templateId}: leftover {IF} blocks`).not.toContain('{IF ');
      expect(fullXml, `${templateId}: leftover {END-IF} blocks`).not.toContain('{END-IF}');
    },
    seconds(30)
  );
});

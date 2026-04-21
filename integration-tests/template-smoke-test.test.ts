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

const it = itAllure.epic('Filling & Rendering');

const TEMPLATES_DIR = resolve(__dirname, '../content/templates');
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

// Only test templates that actually exist in content/templates
const testCases = fixtureFiles.filter((id) =>
  existsSync(join(TEMPLATES_DIR, id, 'template.docx'))
);

describe('E2E smoke test — fill all templates with complete field data', () => {
  it.each(testCases)(
    '%s fills cleanly with all fields populated',
    async (templateId) => {
      const templateDir = join(TEMPLATES_DIR, templateId);
      const fixtureData = JSON.parse(
        readFileSync(join(FIXTURES_DIR, `${templateId}.json`), 'utf-8')
      ) as Record<string, unknown>;

      const tempDir = mkdtempSync(join(tmpdir(), `smoke-${templateId}-`));
      tempDirs.push(tempDir);
      const outputPath = join(tempDir, `${templateId}-filled.docx`);

      // Fill template through the full pipeline (clean → patch → selections → fill)
      await fillTemplate({ templateDir, values: fixtureData, outputPath });

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

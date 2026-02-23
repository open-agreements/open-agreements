import { describe, expect } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  itAllure,
  allurePrettyJsonAttachment,
  allureFileAttachment,
  allureDescription,
  allureImageAttachment,
} from './helpers/allure-test.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const EVIDENCE_DIR = resolve(REPO_ROOT, 'site', 'assets', 'evidence', 'nda-fill');

const it = itAllure.epic('Filling & Rendering');

describe('Canonical Evidence Story: NDA Fill', () => {
  it.openspec('OA-132')(
    'fills Common Paper Mutual NDA from JSON payload and produces a valid DOCX',
    async () => {
      await allureDescription(
        'Canonical evidence story: verifies the fill pipeline produces a correct DOCX ' +
          'from a structured JSON payload for the Common Paper Mutual NDA template.',
      );

      // Step 1: Read the evidence input payload
      const inputPath = resolve(EVIDENCE_DIR, 'input.json');
      expect(existsSync(inputPath)).toBe(true);
      const inputRaw = readFileSync(inputPath, 'utf-8');
      const payload = JSON.parse(inputRaw);

      await allurePrettyJsonAttachment('input-payload.json', payload);

      expect(payload.template_id).toBe('common-paper-mutual-nda');
      expect(payload.fields).toBeDefined();
      expect(payload.fields.purpose).toContain('Acme Corp');
      expect(payload.fields.effective_date).toBe('2026-03-01');

      // Step 2: Fill the template using the CLI
      const outputPath = resolve('/tmp', `evidence-nda-${Date.now()}.docx`);
      const fieldsPath = resolve('/tmp', `evidence-nda-fields-${Date.now()}.json`);

      // Write just the fields (the CLI expects a flat object, not the wrapper)
      writeFileSync(fieldsPath, JSON.stringify(payload.fields, null, 2));

      try {
        const result = execSync(
          `node ${resolve(REPO_ROOT, 'bin', 'open-agreements.js')} fill ${payload.template_id} -d ${fieldsPath} -o ${outputPath}`,
          { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 30000 },
        );
        expect(result).toContain('Filled');
      } finally {
        try { unlinkSync(fieldsPath); } catch { /* ignore */ }
      }

      // Step 3: Verify the output DOCX exists and has content
      expect(existsSync(outputPath)).toBe(true);
      const docxBuffer = readFileSync(outputPath);
      expect(docxBuffer.length).toBeGreaterThan(1000);

      // Verify it's a valid ZIP (DOCX files start with PK header)
      expect(docxBuffer[0]).toBe(0x50); // 'P'
      expect(docxBuffer[1]).toBe(0x4b); // 'K'

      await allureFileAttachment('filled-nda.docx', outputPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      // Step 4: Attach the pre-generated output PNG if it exists
      const pngPath = resolve(EVIDENCE_DIR, 'output.png');
      if (existsSync(pngPath)) {
        await allureImageAttachment('filled-nda-page1.png', pngPath);
      }

      // Cleanup
      try { unlinkSync(outputPath); } catch { /* ignore */ }
    },
  );
});

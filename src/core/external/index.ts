import { mkdtempSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { loadExternalMetadata, loadCleanConfig } from '../metadata.js';
import { resolveExternalDir } from '../../utils/paths.js';
import { cleanDocument } from '../recipe/cleaner.js';
import { patchDocument } from '../recipe/patcher.js';
import { verifyOutput } from '../recipe/verifier.js';
import { prepareFillData, fillDocx } from '../fill-pipeline.js';
import type { ExternalFillOptions, ExternalFillResult } from './types.js';

/**
 * Run the external fill pipeline: integrity check → clean → patch → fill → verify.
 * Uses the local DOCX file from the external/ directory (never modifies the original).
 */
export async function runExternalFill(options: ExternalFillOptions): Promise<ExternalFillResult> {
  const { externalId, outputPath, values, keepIntermediate } = options;
  const externalDir = resolveExternalDir(externalId);

  const metadata = loadExternalMetadata(externalDir);

  // SHA-256 integrity check
  const docxPath = join(externalDir, 'template.docx');
  const docxBuf = readFileSync(docxPath);
  const actualHash = createHash('sha256').update(docxBuf).digest('hex');
  if (actualHash !== metadata.source_sha256) {
    throw new Error(
      `Integrity check failed for "${externalId}": DOCX has been modified.\n` +
      `  Expected SHA-256: ${metadata.source_sha256}\n` +
      `  Actual SHA-256:   ${actualHash}`
    );
  }

  // CC-BY-ND redistribution warning
  console.log(
    `\nNote: This is an external document (${metadata.license}). ` +
    `You may fill it for your own use, but do not redistribute modified versions.\n` +
    `See: ${metadata.source_url}\n`
  );

  // Load clean config and replacements
  const cleanConfig = loadCleanConfig(externalDir);
  const replacementsPath = join(externalDir, 'replacements.json');
  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));

  // Create temp directory for intermediate files
  const tempDir = mkdtempSync(join(tmpdir(), `external-${externalId}-`));
  const stages: ExternalFillResult['stages'] = { clean: '', patch: '', fill: '' };

  try {
    // Copy source to temp dir
    const sourcePath = join(tempDir, 'source.docx');
    copyFileSync(docxPath, sourcePath);

    // Stage 1: Clean
    const cleanedPath = join(tempDir, 'cleaned.docx');
    await cleanDocument(sourcePath, cleanedPath, cleanConfig);
    stages.clean = cleanedPath;

    // Stage 2: Patch (replace [brackets] with {template_tags})
    const patchedPath = join(tempDir, 'patched.docx');
    await patchDocument(cleanedPath, patchedPath, replacements);
    stages.patch = patchedPath;

    // Stage 3: Fill (render template tags with values)
    const fillData = prepareFillData({
      values,
      fields: metadata.fields,
      useBlankPlaceholder: true,
    });

    const filledPath = join(tempDir, 'filled.docx');
    const templateBuf = readFileSync(patchedPath);
    const filledBuf = await fillDocx({
      templateBuffer: templateBuf,
      data: fillData,
    });
    writeFileSync(filledPath, filledBuf);
    stages.fill = filledPath;

    // Stage 4: Verify
    const verifyResult = await verifyOutput(filledPath, values, replacements, cleanConfig);
    if (!verifyResult.passed) {
      const failures = verifyResult.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.details ?? 'failed'}`)
        .join('; ');
      console.warn(`Warning: verification issues: ${failures}`);
    }

    // Copy final output to destination
    copyFileSync(filledPath, outputPath);

    if (keepIntermediate) {
      console.log(`Intermediate files preserved at: ${tempDir}`);
    }

    return {
      outputPath,
      metadata,
      fieldsUsed: Object.keys(values),
      stages,
    };
  } finally {
    if (!keepIntermediate) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export type { ExternalFillOptions, ExternalFillResult } from './types.js';

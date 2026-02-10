import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadExternalMetadata, loadCleanConfig } from '../metadata.js';
import { resolveExternalDir } from '../../utils/paths.js';
import { verifyOutput } from '../recipe/verifier.js';
import { runFillPipeline } from '../unified-pipeline.js';
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

  const result = await runFillPipeline({
    inputPath: docxPath,
    outputPath,
    values,
    fields: metadata.fields,
    cleanPatch: { cleanConfig, replacements },
    verify: (p) => verifyOutput(p, values, replacements, cleanConfig),
    keepIntermediate,
  });

  return {
    outputPath: result.outputPath,
    metadata,
    fieldsUsed: result.fieldsUsed,
    stages: result.stages!,
  };
}

export type { ExternalFillOptions, ExternalFillResult } from './types.js';

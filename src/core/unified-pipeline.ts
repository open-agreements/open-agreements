/**
 * Unified fill pipeline — shared orchestration for all three fill paths
 * (bundled templates, external/vendored, and recipes).
 *
 * Each path is now a thin wrapper that builds PipelineOptions and calls
 * runFillPipeline(). The data-prep and fill steps come from fill-pipeline.ts;
 * this module handles the surrounding orchestration: temp dir, copy, clean→patch,
 * selections, fill, verify, cleanup.
 */

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareFillData, fillDocx } from './fill-pipeline.js';
import { cleanDocument } from './recipe/cleaner.js';
import { patchDocument } from './recipe/patcher.js';
import { applySelections } from './selector.js';
import type { FieldDefinition, CleanConfig } from './metadata.js';
import type { SelectionsConfig } from './selector.js';
import type { VerifyResult } from './recipe/types.js';

export interface PipelineOptions {
  inputPath: string;                    // Source .docx
  outputPath: string;                   // Final output .docx
  values: Record<string, string | boolean>;
  fields: FieldDefinition[];

  // Clean/Patch — omit to skip (templates without replacements.json)
  cleanPatch?: {
    cleanConfig: CleanConfig;
    replacements: Record<string, string>;
  };

  // Selections — omit to skip (only templates with selections.json)
  selectionsConfig?: SelectionsConfig;

  // prepareFillData options
  coerceBooleans?: boolean;             // default: false
  computeDisplayFields?: (data: Record<string, string | boolean>) => void;

  // fillDocx options
  fixSmartQuotes?: boolean;             // default: false

  // Verification callback — each path passes its own verifier
  verify: (outputPath: string) => VerifyResult | Promise<VerifyResult>;

  // Debugging
  keepIntermediate?: boolean;           // default: false
}

export interface PipelineResult {
  outputPath: string;
  fieldsUsed: string[];
  stages?: { clean: string; patch: string; fill: string };
}

/**
 * Run the unified fill pipeline:
 * 1. Create temp dir
 * 2. Copy inputPath → temp source.docx
 * 3. If cleanPatch: clean → patch
 * 4. prepareFillData (useBlankPlaceholder: true)
 * 5. If selectionsConfig: apply selections
 * 6. fillDocx → temp filled.docx
 * 7. Copy filled.docx → outputPath
 * 8. Run verify(outputPath), warn on failures
 * 9. Cleanup temp dir (unless keepIntermediate)
 */
export async function runFillPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const {
    inputPath,
    outputPath,
    values,
    fields,
    cleanPatch,
    selectionsConfig,
    coerceBooleans = false,
    computeDisplayFields,
    fixSmartQuotes = false,
    verify,
    keepIntermediate = false,
  } = options;

  const tempDir = mkdtempSync(join(tmpdir(), 'fill-pipeline-'));
  let stages: PipelineResult['stages'] | undefined;

  try {
    // Step 2: Copy source to temp dir
    const sourcePath = join(tempDir, 'source.docx');
    copyFileSync(inputPath, sourcePath);

    // Step 3: Clean → Patch (if configured)
    let currentPath = sourcePath;
    if (cleanPatch) {
      const cleanedPath = join(tempDir, 'cleaned.docx');
      await cleanDocument(sourcePath, cleanedPath, cleanPatch.cleanConfig);

      const patchedPath = join(tempDir, 'patched.docx');
      await patchDocument(cleanedPath, patchedPath, cleanPatch.replacements);

      currentPath = patchedPath;
      stages = { clean: cleanedPath, patch: patchedPath, fill: '' };
    }

    // Step 4: Prepare fill data
    const data = prepareFillData({
      values,
      fields,
      useBlankPlaceholder: true,
      coerceBooleans,
      computeDisplayFields,
    });

    // Step 5: Read current buffer; apply selections if configured
    let templateBuf: Buffer = readFileSync(currentPath);
    if (selectionsConfig) {
      const preSelectPath = join(tempDir, 'pre-select.docx');
      const postSelectPath = join(tempDir, 'post-select.docx');
      writeFileSync(preSelectPath, templateBuf);
      await applySelections(preSelectPath, postSelectPath, selectionsConfig, data);
      templateBuf = readFileSync(postSelectPath);
    }

    // Step 6: Fill
    const filledBuf = await fillDocx({
      templateBuffer: templateBuf,
      data,
      fixSmartQuotes,
    });

    const filledPath = join(tempDir, 'filled.docx');
    writeFileSync(filledPath, filledBuf);
    if (stages) {
      stages.fill = filledPath;
    }

    // Step 7: Copy to output
    copyFileSync(filledPath, outputPath);

    // Step 8: Verify
    const verifyResult = await verify(outputPath);
    if (!verifyResult.passed) {
      const failures = verifyResult.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.details ?? 'failed'}`)
        .join('; ');
      console.warn(`Warning: verification issues: ${failures}`);
    }

    if (keepIntermediate) {
      console.log(`Intermediate files preserved at: ${tempDir}`);
    }

    return {
      outputPath,
      fieldsUsed: Object.keys(data),
      stages,
    };
  } finally {
    // Step 9: Cleanup
    if (!keepIntermediate) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

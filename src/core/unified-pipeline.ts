/**
 * Unified fill pipeline — shared orchestration for all three fill paths
 * (bundled templates, external/vendored, and fieldSelectors).
 *
 * Each path is now a thin wrapper that builds PipelineOptions and calls
 * runFillPipeline(). The data-prep and fill steps come from fill-pipeline.ts;
 * this module handles the surrounding orchestration: temp dir, copy, clean→patch,
 * selections, fill, verify, cleanup.
 */

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { getParagraphText, replaceParagraphTextRange } from '@usejunior/docx-core';
import { listCommands } from 'docx-templates';
import { prepareFillData, fillDocx, type ConfirmClauseDescriptor } from './fill-pipeline.js';
import { cleanDocument } from './field-selector/cleaner.js';
import { patchDocument } from './field-selector/patcher.js';
import { applySelectorContracts, type FieldSelectorManifest, type FieldResolution } from './selectors/index.js';
import { applySelections } from './selector.js';
import { enumerateTextParts, getGeneralTextPartNames, rezipWithoutDirEntries } from './field-selector/ooxml-parts.js';
import type { FieldDefinition, CleanConfig } from './metadata.js';
import type { SelectionsConfig } from './selector.js';
import type { VerifyResult } from './field-selector/types.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface PipelineOptions {
  inputPath: string;                    // Source .docx
  outputPath: string;                   // Final output .docx
  values: Record<string, unknown>;
  fields: FieldDefinition[];
  priorityFieldNames?: string[];

  // Clean/Patch — omit to skip (templates without replacements.json)
  cleanPatch?: {
    cleanConfig: CleanConfig;
    replacements: Record<string, string | { value: string; format?: Record<string, unknown> }>;
  };

  // Selector contracts — deterministic locator patching that runs AFTER clean
  // and BEFORE the legacy patch. Omit (or pass []) to skip. The replacements
  // dict above must already have these fields' migrated_keys removed; the
  // verifier still receives the full key set so missed occurrences are caught.
  selectorManifests?: FieldSelectorManifest[];
  // Optional sink for selector resolution results (drift reporting).
  onSelectorResolved?: (fields: FieldResolution[]) => void;

  // Selections — omit to skip (only templates with selections.json)
  selectionsConfig?: SelectionsConfig;

  // prepareFillData options
  coerceBooleans?: boolean;             // default: false
  computeDisplayFields?: (data: Record<string, unknown>) => void;
  confirmClauses?: ConfirmClauseDescriptor[];    // confirm= clauses → any_confirmation_pending

  // fillDocx options
  fixSmartQuotes?: boolean;             // default: false

  // Verification callback — each path passes its own verifier. The second
  // argument is the cleaned-but-unfilled source (present only when cleanPatch is
  // configured); verifiers use it to baseline pre-existing source anomalies so
  // only fill-introduced ones are reported. The third argument is the set of
  // identifiers referenced by fill commands in the FINAL pre-fill document
  // (post clean/selector/patch/selections); verifiers can use it to skip
  // value-presence checks for supplied fields whose only fill site was removed
  // by an unselected alternative (selections.json), so a caller supplying a
  // value for the inactive branch is not warned "Missing".
  verify: (
    outputPath: string,
    cleanedSourcePath?: string,
    referencedFields?: Set<string>,
  ) => VerifyResult | Promise<VerifyResult>;
  postProcess?: (outputPath: string) => void | Promise<void>;

  // Debugging
  keepIntermediate?: boolean;           // default: false
}

export interface PipelineResult {
  outputPath: string;
  /**
   * Prepared data keys that are actually referenced by a fill command
   * ({field}, {IF field}, {FOR x IN field}) in the final pre-fill document.
   * Includes blank-defaulted fields (they genuinely substitute an empty
   * placeholder); excludes caller-supplied keys the document never consumes.
   */
  fieldsUsed: string[];
  /** Subset of fieldsUsed whose values the caller actually supplied. */
  providedFieldsUsed: string[];
  /** Fill commands found in the final pre-fill document (post clean/patch/selections). */
  fillCommandCount: number;
  /**
   * Structured guardrail warnings for callers (CLI/API/MCP): zero-fill-command
   * documents, failed verification checks. Other advisory console output
   * (priority fields, selector warnings, zero-match patch keys) intentionally
   * stays console-only for now.
   */
  warnings: string[];
  stages?: { clean: string; patch: string; fill: string };
}

/**
 * Static command-reference analysis of the final pre-fill document.
 *
 * Uses docx-templates listCommands() — the same parser fillDocx's
 * createReport() uses — to enumerate {…} commands and collect every
 * identifier referenced in INS/IF/FOR command expressions. This is a static
 * superset of what the fill will read (it does not execute conditionals),
 * NOT runtime value-read telemetry; for the current template corpus all
 * command expressions are bare identifiers / `FOR x IN y` / `$x.prop`, so
 * the intersection with data keys is exact.
 *
 * Known accepted imprecision: fillDocx strips drafting-note paragraphs after
 * this analysis, so a token that lives only inside a stripped drafting note
 * would still be counted.
 */
async function analyzeFillCommands(templateBuf: Buffer): Promise<{
  commandCount: number;
  referencedIdentifiers: Set<string>;
}> {
  const commands = await listCommands(
    templateBuf.buffer.slice(templateBuf.byteOffset, templateBuf.byteOffset + templateBuf.byteLength) as ArrayBuffer,
    ['{', '}']
  );
  const referencedIdentifiers = new Set<string>();
  for (const command of commands) {
    if (command.type !== 'INS' && command.type !== 'IF' && command.type !== 'FOR') continue;
    for (const match of command.code.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      referencedIdentifiers.add(match[0]);
    }
  }
  return { commandCount: commands.length, referencedIdentifiers };
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
    priorityFieldNames = [],
    cleanPatch,
    selectorManifests,
    onSelectorResolved,
    selectionsConfig,
    coerceBooleans = false,
    computeDisplayFields,
    fixSmartQuotes = false,
    verify,
    postProcess,
    keepIntermediate = false,
  } = options;

  const tempDir = mkdtempSync(join(tmpdir(), 'fill-pipeline-'));
  const syntheticFieldKeys = new Set(
    fields
      .filter((field) => field.type === 'multiselect' && field.derive_booleans === true)
      .flatMap((field) => (field.options ?? []).map((option) => `${option}_enabled`))
  );
  // The cover-notice derived boolean is synthetic — exclude it from fieldsUsed.
  if (options.confirmClauses && options.confirmClauses.length > 0) {
    syntheticFieldKeys.add('any_confirmation_pending');
  }
  let stages: PipelineResult['stages'] | undefined;

  try {
    // Step 2: Copy source to temp dir
    const sourcePath = join(tempDir, 'source.docx');
    copyFileSync(inputPath, sourcePath);

    // Step 3: Clean → Patch (if configured)
    let currentPath = sourcePath;
    // Cleaned-but-unfilled source, threaded to verify() as the formatting-anomaly
    // baseline so pre-existing source anomalies are not reported as fill defects.
    let cleanedSourcePath: string | undefined;
    if (cleanPatch) {
      const cleanedPath = join(tempDir, 'cleaned.docx');
      await cleanDocument(sourcePath, cleanedPath, cleanPatch.cleanConfig);
      cleanedSourcePath = cleanedPath;

      // Selector-contract patch (deterministic locators) runs between clean and
      // the legacy patch. It rewrites resolved occurrences to {field_id} tags;
      // those fields' keys have already been removed from cleanPatch.replacements
      // (the declarative migrated_keys cutover) so each field is patched once.
      let patchInputPath = cleanedPath;
      if (selectorManifests && selectorManifests.length > 0) {
        const selectedPath = join(tempDir, 'selected.docx');
        const selectorResult = await applySelectorContracts(cleanedPath, selectedPath, selectorManifests);
        onSelectorResolved?.(selectorResult.fields);
        for (const warning of selectorResult.warnings) {
          console.warn(`Selector warning: ${warning}`);
        }
        patchInputPath = selectedPath;
      }

      const patchedPath = join(tempDir, 'patched.docx');
      const patchResult = await patchDocument(patchInputPath, patchedPath, cleanPatch.replacements);

      // Suppress zero-match warnings for keys whose search text appears in
      // cleaned content (removeRanges, removeParagraphPatterns, removeBeforePattern).
      // These keys target text that was intentionally removed by clean.json.
      const cleanPatterns = [
        ...cleanPatch.cleanConfig.removeParagraphPatterns,
        ...cleanPatch.cleanConfig.removeRanges.flatMap(r => [r.start, r.end]),
        ...(cleanPatch.cleanConfig.removeBeforePattern ? [cleanPatch.cleanConfig.removeBeforePattern] : []),
      ];
      const unexpectedZeroMatch = patchResult.zeroMatchKeys.filter(key => {
        // Extract just the search text portion (after > for context keys)
        const sepIdx = key.indexOf(' > ');
        const searchText = sepIdx !== -1 ? key.slice(sepIdx + 3) : key;
        // Suppress if any clean pattern relates to this key's search text
        return !cleanPatterns.some(p => p.includes(searchText) || searchText.includes(p));
      });

      if (unexpectedZeroMatch.length > 0) {
        console.warn(
          `Note: ${unexpectedZeroMatch.length} replacement key(s) had zero matches: ${unexpectedZeroMatch.join(', ')}`
        );
      }

      currentPath = patchedPath;
      stages = { clean: cleanedPath, patch: patchedPath, fill: '' };
    }

    // Step 4: Prepare fill data.
    // Display-field computation is instrumented so field-usage reporting can
    // credit the SOURCE fields consumed while deriving a computed key (e.g.
    // party_1_company feeds party_1_company_display, and only the _display
    // key appears in the document).
    const computeReads = new Set<string>();
    const computeWrites = new Set<string>();
    const instrumentedCompute = computeDisplayFields
      ? (d: Record<string, unknown>) => {
          const proxy = new Proxy(d, {
            get(target, prop, receiver) {
              if (typeof prop === 'string') computeReads.add(prop);
              return Reflect.get(target, prop, receiver);
            },
            set(target, prop, value, receiver) {
              if (typeof prop === 'string') computeWrites.add(prop);
              return Reflect.set(target, prop, value, receiver);
            },
          });
          computeDisplayFields(proxy);
        }
      : undefined;
    const data = prepareFillData({
      values,
      fields,
      priorityFieldNames,
      useBlankPlaceholder: true,
      coerceBooleans,
      computeDisplayFields: instrumentedCompute,
      confirmClauses: options.confirmClauses,
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

    // Step 5.5: Analyze fill commands on the exact buffer handed to fillDocx —
    // after clean → selector-contracts → patch → selections, so patch-injected
    // tokens (e.g. the yc-safe externals) are counted.
    const warnings: string[] = [];
    const { commandCount, referencedIdentifiers } = await analyzeFillCommands(templateBuf);
    if (commandCount === 0) {
      warnings.push(
        'Template artifact contains no machine-fillable fields after clean/patch/selections; ' +
        'the document is returned unchanged (manual-fill variant). Provided values were not applied.'
      );
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

    // Collapse double spaces left by empty field substitutions (e.g. {initial_word_lower} → "")
    await collapseDoubleSpacesInDocx(filledPath);

    // Step 7: Copy to output
    copyFileSync(filledPath, outputPath);

    // Optional post-processing for field-selector-specific normalization.
    if (postProcess) {
      await postProcess(outputPath);
    }

    // Step 8: Verify — failures surface to callers via warnings (soft; no throw)
    const verifyResult = await verify(outputPath, cleanedSourcePath, referencedIdentifiers);
    if (!verifyResult.passed) {
      const failedChecks = verifyResult.checks.filter((c) => !c.passed);
      const failures = failedChecks
        .map((c) => `${c.name}: ${c.details ?? 'failed'}`)
        .join('; ');
      console.warn(`Warning: verification issues: ${failures}`);
      for (const check of failedChecks) {
        warnings.push(`verify: ${check.name}: ${check.details ?? 'failed'}`);
      }
    }

    if (keepIntermediate) {
      console.log(`Intermediate files preserved at: ${tempDir}`);
    }

    // A key counts as "used" when the document references it directly, or when
    // it was read while deriving a computed key the document references
    // (source fields of *_display values must be credited — only the computed
    // key appears in the document).
    const anyComputedKeyReferenced = [...computeWrites].some((key) =>
      referencedIdentifiers.has(key)
    );
    const usedKeys = new Set(referencedIdentifiers);
    if (anyComputedKeyReferenced) {
      for (const key of computeReads) usedKeys.add(key);
    }
    const fieldsUsed = Object.keys(data).filter(
      (key) => usedKeys.has(key) && !syntheticFieldKeys.has(key)
    );
    const providedKeys = new Set(Object.keys(values));
    return {
      outputPath,
      fieldsUsed,
      providedFieldsUsed: fieldsUsed.filter((key) => providedKeys.has(key)),
      fillCommandCount: commandCount,
      warnings,
      stages,
    };
  } finally {
    // Step 9: Cleanup
    if (!keepIntermediate) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Collapse runs of 2+ spaces into a single space within all text paragraphs.
 * Fixes double spaces left when empty field substitutions (e.g. {initial_word_lower} → "")
 * leave adjacent spaces in the DOCX.
 *
 * Paragraphs containing Word field characters (w:fldChar) are skipped because
 * getParagraphText treats field-code runs as empty, so "Page " + PAGE field +
 * " of " looks like "Page  of " and the replacement would delete the field run
 * that sits between the two space-bearing runs.
 */
async function collapseDoubleSpacesInDocx(docxPath: string): Promise<void> {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);
  let anyModified = false;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
    let partModified = false;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i] as unknown as globalThis.Element;
      if (para.getElementsByTagNameNS(W_NS, 'fldChar').length > 0) {
        continue;
      }
      let text = getParagraphText(para);
      let match: RegExpExecArray | null;
      while ((match = / {2,}/.exec(text)) !== null) {
        try {
          replaceParagraphTextRange(para, match.index, match.index + match[0].length, ' ');
          partModified = true;
        } catch {
          break;
        }
        text = getParagraphText(para);
      }
    }

    if (partModified) {
      zip.updateFile(partName, Buffer.from(serializer.serializeToString(doc), 'utf-8'));
      anyModified = true;
    }
  }

  if (anyModified) {
    writeFileSync(docxPath, rezipWithoutDirEntries(zip).toBuffer());
  }
}

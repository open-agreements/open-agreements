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
import { applySelections, classifySelectionMatches, describeSelectionOption } from './selector.js';
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
  /**
   * What to do when an UNSELECTED selections option matches zero paragraphs
   * inside a group whose other options DID match (#720): the alternative that
   * was meant to be removed is still in the document, so the output carries
   * both alternatives.
   *
   * `'warn'` (default) reports it in `PipelineResult.warnings`; `'error'`
   * rejects the fill. The default is `'warn'` only because the bundled
   * `templates/` corpus carries three pre-existing marker mismatches this repo
   * cannot fix (see the note at the call site) — it is not a judgement that the
   * condition is acceptable.
   */
  selectionsZeroMatchPolicy?: 'error' | 'warn';

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
  /**
   * Structural source transformation that must run after cleaning but before
   * selector/legacy scalar patching. Generated content must contain no fill
   * commands because command analysis and filling happen later.
   */
  prePatchProcess?: (inputPath: string, outputPath: string) => void | Promise<void>;
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
    selectionsZeroMatchPolicy = 'warn',
    coerceBooleans = false,
    computeDisplayFields,
    fixSmartQuotes = false,
    verify,
    prePatchProcess,
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

      let structuralInputPath = cleanedPath;
      if (prePatchProcess) {
        const structurallyProcessedPath = join(tempDir, 'structural.docx');
        await prePatchProcess(cleanedPath, structurallyProcessedPath);
        structuralInputPath = structurallyProcessedPath;
      }

      // Selector-contract patch (deterministic locators) runs between clean and
      // the legacy patch. It rewrites resolved occurrences to {field_id} tags;
      // those fields' keys have already been removed from cleanPatch.replacements
      // (the declarative migrated_keys cutover) so each field is patched once.
      let patchInputPath = structuralInputPath;
      if (selectorManifests && selectorManifests.length > 0) {
        const selectedPath = join(tempDir, 'selected.docx');
        const selectorResult = await applySelectorContracts(structuralInputPath, selectedPath, selectorManifests);
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
    } else if (prePatchProcess) {
      const structurallyProcessedPath = join(tempDir, 'structural.docx');
      await prePatchProcess(sourcePath, structurallyProcessedPath);
      currentPath = structurallyProcessedPath;
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

    const warnings: string[] = [];

    // Step 5: Read current buffer; apply selections if configured
    let templateBuf: Buffer = readFileSync(currentPath);
    if (selectionsConfig) {
      const preSelectPath = join(tempDir, 'pre-select.docx');
      const postSelectPath = join(tempDir, 'post-select.docx');
      writeFileSync(preSelectPath, templateBuf);
      const selectionsResult = await applySelections(preSelectPath, postSelectPath, selectionsConfig, data);
      templateBuf = readFileSync(postSelectPath);

      // #720: an UNSELECTED selections option that was never actually removed is
      // not a no-op. The intent is "delete this alternative", so nothing having
      // been deleted means the filled document ships BOTH alternatives —
      // legally wrong, and invisible to every other check because the result
      // still renders cleanly. Two faults produce it: a marker that matched
      // nothing (source drift), and a group that matched but resolved no
      // location to act on. `appliedCount` catches both; `matchCount` alone
      // catches only the first.
      //
      // The `engaged group` qualifier is what separates the dangerous case from
      // the benign one. A group whose OTHER options matched is demonstrably
      // present in this document, so a zero-match sibling means that option's
      // marker drifted away from source prose that is still there. A group where
      // NOTHING matched is a config/document mismatch (a partial fixture, a
      // different source variant); nothing was left half-removed there.
      //
      // POLICY. The dangerous case is a warning by DEFAULT, not a hard failure,
      // and that default is a deliberate concession to the bundled corpus rather
      // than a judgement that the condition is tolerable. Turning this guard on
      // surfaced three pre-existing marker/document mismatches in bundled
      // Common Paper configs (an "Order Form" cover page whose marker says
      // "Cover Page"; a straight-vs-curly apostrophe in the workers'-compensation
      // insurance marker; a SOW-term marker naming `{term_duration_value}` where
      // the patched text carries `{rejection_period_value}`). Those configs live
      // under `templates/`, which this repo does not own — it is replaced
      // wholesale by an upstream forward sync — so failing closed today would
      // refuse to fill half a dozen shipped templates over defects that cannot
      // be fixed here. Callers that own their configs can opt into failing
      // closed with `selectionsZeroMatchPolicy: 'error'`, and the default should
      // flip once the upstream configs are corrected.
      const anomalies = classifySelectionMatches(selectionsResult);

      if (anomalies.unremovedInEngagedGroup.length > 0) {
        const detail = anomalies.unremovedInEngagedGroup
          .map((o) => `${describeSelectionOption(o)} [matched ${o.matchCount}, removed ${o.appliedCount}]`)
          .join('; ');
        const message =
          `selections: ${anomalies.unremovedInEngagedGroup.length} unselected option(s) were not removed while a ` +
          `sibling option in the same group did match. The alternative each was meant to remove is still in the ` +
          `document, so the filled output carries BOTH alternatives. A zero match count means the marker text ` +
          `drifted from the source; a non-zero match count with nothing removed means the group resolved no ` +
          `location to act on (e.g. its options sit in different table cells). Offending option(s): ${detail}`;
        if (selectionsZeroMatchPolicy === 'error') {
          throw new Error(`[selections] ${message}`);
        }
        warnings.push(message);
      }

      if (selectionsZeroMatchPolicy === 'error' && anomalies.selectedZeroMatch.length > 0) {
        const detail = anomalies.selectedZeroMatch
          .map((o) => `${describeSelectionOption(o)} [matched ${o.matchCount}]`)
          .join('; ');
        throw new Error(
          `[selections] selected option(s) are absent from the document; refusing to emit a document that did ` +
          `not implement the requested choice: ${detail}`,
        );
      }

      for (const o of anomalies.unremovedInInertGroup) {
        warnings.push(
          `selections: unselected option ${describeSelectionOption(o)} matched zero paragraphs, and no option in ` +
          `that group matched either — the group does not apply to this document.`,
        );
      }
      for (const o of anomalies.selectedZeroMatch) {
        warnings.push(
          `selections: selected option ${describeSelectionOption(o)} matched zero paragraphs — the alternative ` +
          `meant to be kept is absent from the document.`,
        );
      }
    }

    // Step 5.5: Analyze fill commands on the exact buffer handed to fillDocx —
    // after clean → selector-contracts → patch → selections, so patch-injected
    // tokens (e.g. the yc-safe externals) are counted.
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
    await normalizeEmptyFillWhitespaceInDocx(filledPath);

    // Step 7: Copy to output
    copyFileSync(filledPath, outputPath);

    // Optional post-processing for field-selector-specific normalization.
    if (postProcess) {
      await postProcess(outputPath);
      // Declarative post-processing can itself remove an optional carrier and
      // expose the same empty-value whitespace seam, so normalize once more on
      // the final artifact.
      await normalizeEmptyFillWhitespaceInDocx(outputPath);
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
 * Close whitespace seams left by empty substitutions within text paragraphs:
 * collapse doubled spaces and remove whitespace immediately before punctuation.
 *
 * Paragraphs containing Word field characters (w:fldChar) are skipped because
 * getParagraphText treats field-code runs as empty, so "Page " + PAGE field +
 * " of " looks like "Page  of " and the replacement would delete the field run
 * that sits between the two space-bearing runs.
 */
export async function normalizeEmptyFillWhitespaceInDocx(docxPath: string): Promise<void> {
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
      while ((match = /[ \t\u00a0]+(?=[,.;:!?])/.exec(text)) !== null) {
        try {
          replaceParagraphTextRange(para, match.index, match.index + match[0].length, '');
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

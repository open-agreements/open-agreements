import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element } from '@xmldom/xmldom';
import { getParagraphText } from '@usejunior/docx-core';
import type { VerifyResult, VerifyCheck } from './types.js';
import { cleanConfigRemovesBodyContent, type CleanConfig } from '../metadata.js';
import { enumerateTextParts, getAllTextPartNames, getGeneralTextPartNames } from './ooxml-parts.js';
import { isParagraphContentEmpty } from './cleaner.js';
import { parseReplacementKey } from './replacement-keys.js';
import { getTableRowContext, normalizeQuotes } from './patcher.js';
import { DOUBLE_PERCENT_PATTERN } from '../fill-utils.js';
import type { ReplacementValue } from './replacement-keys.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Normalize text for value comparison:
 * - Convert non-breaking spaces to regular spaces
 * - Normalize smart quotes to straight quotes
 * - Collapse runs of spaces/tabs to single space (preserve newlines)
 * - Trim
 */
export function normalizeText(text: string): string {
  return text
    // Non-breaking spaces
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    // Smart single quotes → straight
    .replace(/[\u2018\u2019\u2039\u203A]/g, "'")
    // Smart double quotes → straight
    .replace(/[\u201C\u201D\u201A\u201E\u00AB\u00BB]/g, '"')
    // Collapse horizontal whitespace (spaces/tabs) to single space, preserve newlines
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

/**
 * Verify a filled fieldSelector output DOCX:
 * - All context values appear in the document text
 * - No unrendered {template_tags} remain
 * - No leftover [bracketed placeholders] from the replacement map remain
 * - No doubled currency or percent sigils from a value that already carried the
 *   sign the source supplies
 * - Footnotes removed (if clean config specified)
 * - Drafting note paragraphs removed (if clean config specified)
 */
export async function verifyOutput(
  outputPath: string,
  values: Record<string, unknown>,
  replacements: Record<string, ReplacementValue>,
  cleanConfig?: CleanConfig,
  cleanedSourcePath?: string,
): Promise<VerifyResult> {
  const checks: VerifyCheck[] = [];
  const rawFullText = extractAllText(outputPath);
  // Footnotes are outside extractAllText()'s scope. They feed the sigil-doubling
  // checks only: those read rather than rewrite, and every other check here
  // keeps the part scope the patcher and cleaner actually operate on.
  const footnoteText = extractFootnoteText(outputPath);
  const sigilText = footnoteText ? `${rawFullText}\n${footnoteText}` : rawFullText;
  const normalizedFullText = normalizeText(rawFullText);
  const xml = extractDocumentXml(outputPath);

  // Check 0: Word cross-reference fields are structurally complete and point
  // at bookmarks that actually exist. Cached field-result text can make a
  // broken REF look correct until Word or LibreOffice refreshes fields, at
  // which point it becomes "Error: Reference source not found." Validate the
  // underlying OOXML instead of relying on renderer logs or cached display
  // text. This check is fatal because the artifact is not safe to deliver.
  const refDiagnostics = validateWordFields(outputPath);
  checks.push({
    name: 'Word REF fields resolve',
    passed: refDiagnostics.length === 0,
    details: refDiagnostics.length > 0 ? refDiagnostics.join('; ') : undefined,
    fatal: true,
  });

  // Check 1: All context values present (with normalization)
  const missingValues: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string' || !value.trim()) continue; // only verify non-empty text values
    const normalizedValue = normalizeText(value);
    if (!normalizedFullText.includes(normalizedValue)) {
      missingValues.push(`${key}="${value}"`);
    }
  }
  checks.push({
    name: 'Context values present',
    passed: missingValues.length === 0,
    details: missingValues.length > 0 ? `Missing: ${missingValues.join(', ')}` : undefined,
  });

  // Check 3b: Generic signer-facing corruption that is not tied to a recipe's
  // replacement map.  Keep the patterns deliberately narrow; every diagnostic
  // includes the OOXML story and paragraph so a failure is reproducible.
  const outputArtifactFindings = findRenderedTextArtifacts(outputPath);
  const artifactFindings = cleanedSourcePath
    ? subtractBaselinedArtifacts(outputArtifactFindings, findRenderedTextArtifacts(cleanedSourcePath))
    : outputArtifactFindings;
  checks.push({
    name: 'No rendered text artifacts',
    passed: artifactFindings.length === 0,
    details: artifactFindings.length > 0 ? `Found: ${artifactFindings.slice(0, 8).join('; ')}` : undefined,
  });

  // Check 2: No unrendered {template_tags}
  const unrenderedTags = rawFullText.match(/\{[a-z_][a-z0-9_]*\}/gi) ?? [];
  checks.push({
    name: 'No unrendered template tags',
    passed: unrenderedTags.length === 0,
    details: unrenderedTags.length > 0 ? `Found: ${unrenderedTags.join(', ')}` : undefined,
  });

  // Check 3: No leftover [bracketed placeholders] from replacement map.
  // Context-qualified keys ("context > placeholder") are verified at their
  // qualified location — mirroring the patcher's deterministic anchoring — so an
  // intentional occurrence of the same bare token in an unrelated context is not
  // reported as a failed mapped replacement. Simple keys keep whole-document
  // search (a bare placeholder should not survive anywhere).
  const leftoverBrackets = findLeftoverPlaceholders(outputPath, replacements, cleanedSourcePath);
  checks.push({
    name: 'Leftover source placeholders',
    passed: leftoverBrackets.length === 0,
    details: leftoverBrackets.length > 0 ? `Found: ${leftoverBrackets.join(', ')}` : undefined,
  });

  // Check 4: No footnote references (if removeFootnotes was set)
  if (cleanConfig?.removeFootnotes) {
    const footnoteRefs = (xml.match(/(?:footnote|endnote)Reference/g) ?? []).length;
    checks.push({
      name: 'Footnotes removed',
      passed: footnoteRefs === 0,
      details: footnoteRefs > 0 ? `${footnoteRefs} note reference(s) remain` : undefined,
    });
  }

  // Check 5: No double dollar signs ($$ or $ $)
  // This catches cases where the template already has a $ before a placeholder
  // and the user also included a $ in their value (e.g. "$1,000,000")
  const doubleDollarPattern = /\$[\s\u00A0\t]*\$/;
  const doubleDollarLines = sigilText.split('\n').filter((line) => doubleDollarPattern.test(line));
  checks.push({
    name: 'No double dollar signs',
    passed: doubleDollarLines.length === 0,
    details: doubleDollarLines.length > 0
      ? `Found ${doubleDollarLines.length} occurrence(s): "${doubleDollarLines[0].trim().slice(0, 80)}"`
      : undefined,
  });

  // Check 5b: No double percent signs (%% or % %)
  // The trailing-sigil twin of Check 5. Recipes disagree about which side of the
  // seam owns the sign — the ROFR & co-sale replacement key "[specify percentage]%"
  // absorbs the source %, while the certificate of incorporation and stock
  // purchase agreement leave it in place — so a sign-carrying value that is
  // correct for one template doubles the sign in another (issue #719).
  const doublePercentLines = sigilText
    .split('\n')
    .filter((line) => DOUBLE_PERCENT_PATTERN.test(line));
  checks.push({
    name: 'No double percent signs',
    passed: doublePercentLines.length === 0,
    details: doublePercentLines.length > 0
      ? `Found ${doublePercentLines.length} occurrence(s): "${doublePercentLines[0].trim().slice(0, 80)}"`
      : undefined,
  });

  // Check 6: No drafting note paragraphs (if patterns were set)
  if (cleanConfig?.removeParagraphPatterns && cleanConfig.removeParagraphPatterns.length > 0) {
    const regexes = cleanConfig.removeParagraphPatterns.map((p) => new RegExp(p, 'i'));
    const lines = rawFullText.split('\n');
    const matchingLines = lines.filter((line) => regexes.some((r) => r.test(line.trim())));
    checks.push({
      name: 'Drafting notes removed',
      passed: matchingLines.length === 0,
      details: matchingLines.length > 0 ? `Found: ${matchingLines[0].trim().slice(0, 80)}...` : undefined,
    });
  }

  // Check 7: No range-deleted sections (if ranges were set)
  if (cleanConfig?.removeRanges && cleanConfig.removeRanges.length > 0) {
    const rangeStartPatterns = cleanConfig.removeRanges.map((r) => new RegExp(r.start, 'i'));
    const lines = rawFullText.split('\n');
    const matchingLines = lines.filter((line) =>
      rangeStartPatterns.some((r) => r.test(line.trim()))
    );
    checks.push({
      name: 'Range-deleted sections removed',
      passed: matchingLines.length === 0,
      details: matchingLines.length > 0
        ? `Found: ${matchingLines[0].trim().slice(0, 80)}...`
        : undefined,
    });
  }

  // Check 8: No single-character underlined runs adjacent to non-underlined runs
  // This is a hallmark of quota-based text redistribution corrupting formatting.
  // When cleanedSourcePath is provided, only flag NEW anomalies introduced by fill/patch.
  const outputAnomalyCount = countFormattingAnomalies(outputPath);
  const baselineAnomalyCount = cleanedSourcePath ? countFormattingAnomalies(cleanedSourcePath) : 0;
  const newAnomalyCount = Math.max(0, outputAnomalyCount - baselineAnomalyCount);
  checks.push({
    name: 'No formatting anomalies',
    passed: newAnomalyCount === 0,
    details: newAnomalyCount > 0
      ? `Found ${newAnomalyCount} new single-char underlined run(s) adjacent to non-underlined runs (${outputAnomalyCount} total, ${baselineAnomalyCount} in source)`
      : baselineAnomalyCount > 0
        ? `${baselineAnomalyCount} pre-existing anomaly(ies) in source (baselined)`
        : undefined,
  });

  // Check 9: First body paragraph has content (only when the clean config
  // removes body content — a removed range/pattern/cover-page can strand an
  // empty structural paragraph, e.g. one holding a <w:sectPr>, which renders
  // as a blank first page; see issue #605 / legal-explainer#1800)
  if (cleanConfig && cleanConfigRemovesBodyContent(cleanConfig)) {
    const firstParagraphEmpty = hasLeadingBlankPageRisk(outputPath);
    checks.push({
      name: 'First body paragraph has content',
      passed: !firstParagraphEmpty,
      details: firstParagraphEmpty
        ? 'First body paragraph is textless — a cleaning artifact may leave a blank first page/section; consider "removeEmptyLeadingParagraphs": true in clean.json'
        : undefined,
    });
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

interface ComplexFieldFrame {
  instruction: string[];
  hasSeparate: boolean;
  partName: string;
}

function fieldInstruction(el: Element): string {
  return el.getAttributeNS(W_NS, 'instr') || el.getAttribute('w:instr') || el.getAttribute('instr') || '';
}

function refTarget(instruction: string): string | undefined {
  const match = instruction.match(/^\s*REF\s+(?:"([^"]+)"|([^\s\\]+))/i);
  return match?.[1] ?? match?.[2];
}

function describeInstruction(instruction: string): string {
  const compact = instruction.replace(/\s+/g, ' ').trim();
  return compact || '(empty instruction)';
}

/**
 * Return actionable diagnostics for malformed complex Word fields and REF
 * instructions whose bookmark target is absent. Both atomic `w:fldSimple`
 * fields and complex begin/instrText/separate/end fields are supported; field
 * instructions may be split across any number of runs.
 */
export function validateWordFields(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const partNames = getGeneralTextPartNames(enumerateTextParts(zip));
  const bookmarks = new Set<string>();
  const docs: Array<{ partName: string; root: XmlDocument }> = [];

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const root = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    docs.push({ partName, root });
    const starts = root.getElementsByTagNameNS(W_NS, 'bookmarkStart');
    for (let i = 0; i < starts.length; i++) {
      const name = starts[i].getAttributeNS(W_NS, 'name') || starts[i].getAttribute('w:name');
      if (name) bookmarks.add(name);
    }
  }

  const diagnostics: string[] = [];
  const inspectRef = (partName: string, instruction: string, malformed?: string): void => {
    const target = refTarget(instruction);
    if (!target) return;
    const suffix = malformed ? `; invalid field triplet: ${malformed}` : '';
    if (malformed || !bookmarks.has(target)) {
      diagnostics.push(
        `${partName}: REF target "${target}" ${malformed ? 'has an invalid field structure' : 'has no matching bookmark'} ` +
        `(instruction: "${describeInstruction(instruction)}"${suffix})`,
      );
    }
  };

  for (const { partName, root } of docs) {
    const simpleFields = root.getElementsByTagNameNS(W_NS, 'fldSimple');
    for (let i = 0; i < simpleFields.length; i++) {
      inspectRef(partName, fieldInstruction(simpleFields[i] as unknown as Element));
    }

    const stack: ComplexFieldFrame[] = [];
    const visit = (node: Node): void => {
      if (node.nodeType === 1) {
        const el = node as unknown as Element;
        if (el.namespaceURI === W_NS && el.localName === 'fldChar') {
          const type = el.getAttributeNS(W_NS, 'fldCharType') || el.getAttribute('w:fldCharType');
          if (type === 'begin') {
            stack.push({ instruction: [], hasSeparate: false, partName });
          } else if (type === 'separate') {
            const frame = stack[stack.length - 1];
            if (!frame) diagnostics.push(`${partName}: invalid field triplet: orphan separate marker`);
            else if (frame.hasSeparate) diagnostics.push(`${partName}: invalid field triplet: duplicate separate marker`);
            else frame.hasSeparate = true;
          } else if (type === 'end') {
            const frame = stack.pop();
            if (!frame) {
              diagnostics.push(`${partName}: invalid field triplet: orphan end marker`);
            } else {
              inspectRef(partName, frame.instruction.join(''), frame.hasSeparate ? undefined : 'missing separate marker');
            }
          }
          return;
        }
        if (el.namespaceURI === W_NS && el.localName === 'instrText' && stack.length > 0) {
          const frame = stack[stack.length - 1];
          if (!frame.hasSeparate) frame.instruction.push(el.textContent ?? '');
          return;
        }
      }
      for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
    };
    visit(root as unknown as Node);
    for (const frame of stack) {
      const instruction = frame.instruction.join('');
      const target = refTarget(instruction);
      if (target) inspectRef(partName, instruction, 'missing end marker');
      else diagnostics.push(`${partName}: invalid field triplet: missing end marker (instruction: "${describeInstruction(instruction)}")`);
    }
  }

  return [...new Set(diagnostics)];
}

/**
 * Whether the first block-level element of <w:body> is a paragraph with no
 * visible content (no text and no drawing/picture/object).
 */
export function isFirstBodyParagraphEmpty(docxPath: string): boolean {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return false;
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return false;
  for (let node = body.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1) continue;
    const el = node as unknown as Element;
    if (el.localName === 'p' && el.namespaceURI === W_NS) {
      return isParagraphContentEmpty(el);
    }
    return false; // first block element is a table/sdt/... — has content
  }
  return false;
}

/**
 * A textless leading paragraph is common Word scaffolding and is not itself a
 * blank page. Warn only when it also carries explicit page-advancing structure.
 */
export function hasLeadingBlankPageRisk(docxPath: string): boolean {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return false;
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return false;
  for (let node = body.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1) continue;
    const para = node as unknown as Element;
    if (para.localName !== 'p' || para.namespaceURI !== W_NS || !isParagraphContentEmpty(para)) return false;
    if (para.getElementsByTagNameNS(W_NS, 'pageBreakBefore').length > 0) return true;
    const breaks = para.getElementsByTagNameNS(W_NS, 'br');
    for (let i = 0; i < breaks.length; i++) {
      const type = breaks[i].getAttributeNS(W_NS, 'type') || breaks[i].getAttribute('w:type');
      if (type === 'page') return true;
    }
    const sectPr = para.getElementsByTagNameNS(W_NS, 'sectPr')[0];
    if (!sectPr) return false;
    const type = sectPr.getElementsByTagNameNS(W_NS, 'type')[0];
    const value = type && (type.getAttributeNS(W_NS, 'val') || type.getAttribute('w:val'));
    return value === 'nextPage' || value === 'evenPage' || value === 'oddPage';
  }
  return false;
}

export function findRenderedTextArtifacts(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const findings: string[] = [];
  for (const partName of getAllTextPartNames(enumerateTextParts(zip))) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const text = getParagraphText(paras[i] as unknown as globalThis.Element);
      if (!text.trim()) continue;
      const prefix = `${partName}:paragraph ${i + 1}`;
      const report = (kind: string, match: string): void => {
        findings.push(`${prefix} ${kind} ${JSON.stringify(match.slice(0, 60))}`);
      };

      // Unbalanced closing brackets include the observed `]`, `]/`, and `];`
      // corruption while accepting ordinary balanced citations/placeholders.
      let depth = 0;
      for (const char of text) {
        if (char === '[') depth++;
        else if (char === ']' && depth > 0) depth--;
        else if (char === ']') { report('has orphan closing bracket', ']'); break; }
      }

      const spacedPunctuation = text.match(/[ \t\u00a0]+[,;:](?=\s|$)/);
      if (spacedPunctuation) report('has whitespace before punctuation', spacedPunctuation[0]);
      const doubledPunctuation = text.match(/([,;:])\s*\1/);
      if (doubledPunctuation) report('has duplicated punctuation', doubledPunctuation[0]);

      const words = [...text.matchAll(/\b[\p{L}\p{N}][\p{L}\p{N}.-]*\b/gu)];
      const allowedSingleRepeats = new Set(['had', 'that', 'very']);
      for (let w = 1; w < words.length; w++) {
        if (words[w][0].toLocaleLowerCase() === words[w - 1][0].toLocaleLowerCase() &&
            text.slice((words[w - 1].index ?? 0) + words[w - 1][0].length, words[w].index).trim() === '' &&
            !allowedSingleRepeats.has(words[w][0].toLocaleLowerCase())) {
          report('has duplicated word', `${words[w - 1][0]} ${words[w][0]}`);
          break;
        }
      }
      // Repeated two-or-more-token phrases catch duplicated headings such as
      // "Form S-1 Form S-1" without treating a recurring single legal term as noise.
      for (let size = 2; size <= 5 && size * 2 <= words.length; size++) {
        let found = false;
        for (let w = 0; w + size * 2 <= words.length; w++) {
          const a = words.slice(w, w + size).map((m) => m[0].toLocaleLowerCase()).join(' ');
          const b = words.slice(w + size, w + size * 2).map((m) => m[0].toLocaleLowerCase()).join(' ');
          const boundary = text.slice(
            (words[w + size - 1].index ?? 0) + words[w + size - 1][0].length,
            words[w + size].index,
          );
          if (a === b && boundary.trim() === '' && a !== 'time to time') {
            report('has duplicated phrase', words.slice(w, w + size * 2).map((m) => m[0]).join(' ')); found = true; break;
          }
        }
        if (found) break;
      }

      const malformedReference = text.match(/\b(?:under|pursuant to|in accordance with|set forth in|specified in|subject to|see)\s+(?:Sections?|Articles?|Exhibits?|Schedules?)\s+(?=[,.;:)\]]|$|(?:and|or|of|to)\b)/i);
      if (malformedReference) report('has reference without a target', malformedReference[0]);
      const missingPercent = text.match(/\b(?:at least|more than|less than|not less than|not more than)\s+\d+(?:\.\d+)?\s+of\b/i);
      if (missingPercent) report('has percentage threshold without percent sign', missingPercent[0]);
    }
  }
  return findings;
}

/** Remove source-carried findings as a multiset while retaining output locations. */
function subtractBaselinedArtifacts(output: string[], source: string[]): string[] {
  const signature = (finding: string): string => finding.replace(/^.*?:paragraph \d+ /, '');
  const sourceCounts = new Map<string, number>();
  for (const finding of source) {
    const key = signature(finding);
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  return output.filter((finding) => {
    const key = signature(finding);
    const remaining = sourceCounts.get(key) ?? 0;
    if (remaining === 0) return true;
    sourceCounts.set(key, remaining - 1);
    return false;
  });
}

/** A paragraph's normalized text plus its table-row label context (if any). */
interface ParagraphInfo {
  text: string;
  rowContext: string | null;
  fieldResultRanges: Array<{ start: number; end: number }>;
}

/** Character ranges in paragraph text carried by complex Word-field results. */
function getComplexFieldResultRanges(para: Element): Array<{ start: number; end: number }> {
  const states: Array<'instruction' | 'result'> = [];
  const ranges: Array<{ start: number; end: number }> = [];
  let visibleOffset = 0;

  const visit = (node: Node): void => {
    if (node.nodeType === 1) {
      const el = node as unknown as Element;
      if (el.namespaceURI === W_NS && el.localName === 'fldChar') {
        const type = el.getAttributeNS(W_NS, 'fldCharType') || el.getAttribute('w:fldCharType');
        if (type === 'begin') states.push('instruction');
        else if (type === 'separate' && states.length > 0) states[states.length - 1] = 'result';
        else if (type === 'end' && states.length > 0) states.pop();
        return;
      }
      if (el.namespaceURI === W_NS && el.localName === 't') {
        const text = el.textContent ?? '';
        if (states.includes('result') && text.length > 0) {
          ranges.push({ start: visibleOffset, end: visibleOffset + text.length });
        }
        visibleOffset += text.length;
        return;
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  };

  visit(para as unknown as Node);
  return ranges;
}

/**
 * Extract each paragraph's normalized text and table-row label context from a
 * DOCX, using the same normalization (quotes only) the patcher matches on.
 */
function extractParagraphInfos(docxPath: string): ParagraphInfo[] {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const partNames = getGeneralTextPartNames(enumerateTextParts(zip));
  const infos: ParagraphInfo[] = [];
  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const para = paras[i] as unknown as Element;
      const paraText = getParagraphText(para as unknown as globalThis.Element);
      if (!paraText) continue;
      const rowContext = getTableRowContext(para);
      infos.push({
        text: normalizeQuotes(paraText),
        rowContext: rowContext !== null ? normalizeQuotes(rowContext) : null,
        fieldResultRanges: getComplexFieldResultRanges(para),
      });
    }
  }
  return infos;
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  let pos: number;
  while ((pos = haystack.indexOf(needle, from)) !== -1) {
    count++;
    from = pos + needle.length;
  }
  return count;
}

/**
 * Whether replacement search text is itself a signer-facing source artifact.
 *
 * A replacement map can also carry ordinary prose in order to parameterize a
 * value that may render back to the same visible text (for example, the IRA's
 * repeated `this Section 2.8` cross-references).  Treating every replacement
 * key as a placeholder makes that valid source-carried prose a false positive.
 * Keep this check deliberately syntactic: brackets, blank lines, and explicit
 * merge-token delimiters are artifacts; ordinary legal prose is not.
 */
function isSourcePlaceholderText(text: string): boolean {
  return (
    /\[[^\]]*\]/.test(text) ||
    /_{2,}/.test(text) ||
    /\{[a-z_][a-z0-9_]*\}/i.test(text) ||
    /<<[^<>]+>>/.test(text) ||
    /«[^»]+»/.test(text)
  );
}

/**
 * Whether a context key has an unfilled placeholder at its qualified location,
 * mirroring how the patcher targets them:
 *  - Table-row context: a `searchText` survives in a paragraph whose row label
 *    cell contains the context.
 *  - Paragraph context: a `searchText` appears AFTER the first occurrence of the
 *    context in the paragraph (the patcher fills the first placeholder after the
 *    context).
 *
 * Used only when no source baseline is available (see findLeftoverPlaceholders).
 */
function hasQualifiedLeftover(
  paragraphs: ParagraphInfo[],
  context: string,
  searchText: string,
): boolean {
  if (searchText.length === 0) return false;
  for (const { text, rowContext } of paragraphs) {
    if (rowContext !== null) {
      if (rowContext.includes(context) && text.includes(searchText)) return true;
    } else {
      const ctxPos = text.indexOf(context);
      if (ctxPos === -1) continue;
      if (text.indexOf(searchText, ctxPos + context.length) !== -1) return true;
    }
  }
  return false;
}

/** Whether the qualified token is still the cached result of a live Word field. */
function hasQualifiedFieldBackedOccurrence(
  paragraphs: ParagraphInfo[],
  context: string,
  searchText: string,
): boolean {
  return paragraphs.some(({ text, rowContext, fieldResultRanges }) => {
    const contextPos = rowContext !== null ? (rowContext.includes(context) ? 0 : -1) : text.indexOf(context);
    if (contextPos === -1) return false;
    const searchPos = text.indexOf(searchText, rowContext !== null ? 0 : contextPos + context.length);
    if (searchPos === -1) return false;
    const searchEnd = searchPos + searchText.length;
    return fieldResultRanges.some(({ start, end }) => start < searchEnd && end > searchPos);
  });
}

/**
 * Find leftover source placeholders from the replacement map that survive in the
 * filled output.
 *
 * Known limitation (deliberate tradeoff): the count baseline treats ANY
 * reduction of a context key's token as success, so it cannot distinguish an
 * occurrence a selector deliberately retains (e.g. the two documented `[___]` in
 * series_designation) from an unexpected extra occurrence of the same token that
 * failed to fill — the two are textually identical. Fully distinguishing them
 * would require machine-readable retained-occurrence metadata in the field
 * contract (fields/<id>.json), which is out of scope here. Two existing
 * mechanisms cover the realistic paths this check cannot: (a) an unexpected
 * extra token means the source changed, which the source_sha256 pin / source
 * drift canary flags before fill; (b) a DECLARED selector occurrence that fails
 * to resolve surfaces an `unresolved` selector warning.
 *
 * Two key shapes are handled differently, matching how the patcher targets them:
 *
 *  - Simple keys ("[Company Name]") replace every occurrence, so any surviving
 *    occurrence anywhere in the document is reported.
 *
 *  - Context-qualified keys ("context > placeholder") target one placeholder per
 *    context, so a bare token may legitimately remain elsewhere (an unrelated
 *    context) or be deliberately retained (a selector field that fills only its
 *    declared occurrences). These are handled by comparing the placeholder's
 *    count against the cleaned source:
 *      - With a source baseline, a context key is reported only when the fill
 *        reduced NOTHING (output count >= source count) — i.e. the mapping was
 *        entirely unhandled (a genuine defect, e.g. a caption the patcher/
 *        selector never touched), as opposed to a partial reduction that leaves
 *        deliberately-retained or selector-verified occurrences behind. This is
 *        the same deterministic baseline-against-source technique used for
 *        formatting anomalies. Counting is done on the flattened text (the same
 *        text the patcher's replacements ultimately land in) so a context that
 *        is unmatchable due to intra-paragraph line breaks — the #607 caption —
 *        is still caught.
 *      - Without a baseline, the key is reported only if an unfilled placeholder
 *        survives at its qualified location — so an intentional occurrence of the
 *        same token in an unrelated context (e.g. "[s]" in "Management Rights
 *        Letter[s]" while the mapped "Closing > [s]" was filled) is not reported.
 *
 * Returns the offending key labels (simple keys as their search text; context
 * keys as their full "context > placeholder" label).
 */
export function findLeftoverPlaceholders(
  docxPath: string,
  replacements: Record<string, ReplacementValue>,
  cleanedSourcePath?: string,
): string[] {
  const simpleSearchTexts = new Set<string>();
  const contextKeys: { context: string; searchText: string; label: string }[] = [];
  for (const key of Object.keys(replacements)) {
    const parsed = parseReplacementKey(key, '');
    if (parsed.type === 'context') {
      contextKeys.push({
        // Match the patcher's quote normalization so the checks anchor on
        // exactly what the patcher would have targeted.
        context: normalizeQuotes(parsed.context),
        searchText: normalizeQuotes(parsed.searchText),
        label: key,
      });
    } else {
      simpleSearchTexts.add(parsed.searchText);
    }
  }

  const leftovers = new Set<string>();
  const outputFullText = normalizeQuotes(extractAllText(docxPath));

  // Simple keys: whole-document search for actual placeholder-shaped source
  // artifacts. Ordinary prose replacement keys are not placeholders and can
  // legitimately render back to the same visible text.
  for (const text of simpleSearchTexts) {
    if (isSourcePlaceholderText(text) && outputFullText.includes(normalizeQuotes(text))) leftovers.add(text);
  }

  // Context keys: count baseline against the cleaned source, else qualified location.
  if (contextKeys.length > 0) {
    if (cleanedSourcePath) {
      const sourceFullText = normalizeQuotes(extractAllText(cleanedSourcePath));
      const sourceParagraphs = extractParagraphInfos(cleanedSourcePath);
      const outputParagraphs = extractParagraphInfos(docxPath);
      for (const ck of contextKeys) {
        // An ordinary cross-reference can be a legitimate source-carried value.
        // Preserve structural checking for Word REF results, which really must
        // transition to ordinary text when declared for replacement.
        if (!isSourcePlaceholderText(ck.searchText) &&
            !hasQualifiedFieldBackedOccurrence(sourceParagraphs, ck.context, ck.searchText)) {
          continue;
        }
        const srcCount = countOccurrences(sourceFullText, ck.searchText);
        if (srcCount === 0) continue; // key does not apply to this document
        const outCount = countOccurrences(outputFullText, ck.searchText);
        // Nothing filled for this placeholder → the mapping was entirely
        // unhandled. A partial reduction leaves only intentionally-retained /
        // selector-verified occurrences behind, which are not reported.
        if (outCount >= srcCount) {
          // A context-qualified replacement may intentionally render the same
          // visible text as the source (for example, staticizing an atomic REF
          // field from "Section 6.1" to "Section {section}" and then filling
          // the tag with "6.1"). Text counts cannot prove that replacement.
          // In that narrow case, the structural transition from a cached field
          // result to ordinary text does: do not report the full qualified key
          // as a leftover once the field at that qualified location is gone.
          const sourceWasField = hasQualifiedFieldBackedOccurrence(sourceParagraphs, ck.context, ck.searchText);
          const outputIsField = hasQualifiedFieldBackedOccurrence(outputParagraphs, ck.context, ck.searchText);
          if (!sourceWasField || outputIsField) leftovers.add(ck.label);
        }
      }
    } else {
      const outputParagraphs = extractParagraphInfos(docxPath);
      for (const ck of contextKeys) {
        if (isSourcePlaceholderText(ck.searchText) &&
            hasQualifiedLeftover(outputParagraphs, ck.context, ck.searchText)) {
          leftovers.add(ck.label);
        }
      }
    }
  }

  return [...leftovers];
}

/**
 * Count formatting anomalies: single-character underlined runs adjacent to
 * non-underlined runs. This pattern is the hallmark of quota-based text
 * redistribution corrupting run-level formatting.
 */
export function countFormattingAnomalies(docxPath: string): number {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();
  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);
  let count = 0;

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const xmlContent = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');

    for (let i = 0; i < paras.length; i++) {
      const runs = paras[i].getElementsByTagNameNS(W_NS, 'r');
      for (let j = 0; j < runs.length; j++) {
        const run = runs[j];
        const tEls = run.getElementsByTagNameNS(W_NS, 't');
        let runText = '';
        for (let k = 0; k < tEls.length; k++) {
          runText += tEls[k].textContent ?? '';
        }
        if (runText.length !== 1) continue;

        // Check if this run is underlined
        const rPr = run.getElementsByTagNameNS(W_NS, 'rPr');
        if (rPr.length === 0) continue;
        const uEls = rPr[0].getElementsByTagNameNS(W_NS, 'u');
        if (uEls.length === 0) continue;

        // Check adjacent run (next) for non-underlined
        if (j + 1 < runs.length) {
          const nextRun = runs[j + 1];
          const nextRPr = nextRun.getElementsByTagNameNS(W_NS, 'rPr');
          const nextHasUnderline = nextRPr.length > 0 &&
            nextRPr[0].getElementsByTagNameNS(W_NS, 'u').length > 0;
          if (!nextHasUnderline) {
            count++;
          }
        }
      }
    }
  }

  return count;
}

/**
 * Extract all text from general OOXML text parts (document, headers, footers, endnotes).
 */
/**
 * Extract footnote paragraph text, which `extractAllText()` deliberately omits.
 *
 * `getGeneralTextPartNames()` excludes `word/footnotes.xml` because the cleaner
 * has to special-case its separator paragraphs. That constraint is about
 * mutation; the sigil-doubling checks only read, and a footnote rendering
 * `8%%` is a corrupt executed document that must not verify clean.
 */
export function extractFootnoteText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const parts = enumerateTextParts(zip);
  if (!parts.footnotes) return '';
  const entry = zip.getEntry(parts.footnotes);
  if (!entry) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const paragraphs: string[] = [];
  const paras = doc.getElementsByTagNameNS(W_NS, 'p');
  for (let i = 0; i < paras.length; i++) {
    const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
    const textParts: string[] = [];
    for (let j = 0; j < tElements.length; j++) {
      textParts.push(tElements[j].textContent ?? '');
    }
    if (textParts.length > 0) paragraphs.push(textParts.join(''));
  }
  return paragraphs.join('\n');
}

export function extractAllText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const parser = new DOMParser();

  const parts = enumerateTextParts(zip);
  const partNames = getGeneralTextPartNames(parts);

  const allParagraphs: string[] = [];

  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;

    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');

    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
      const textParts: string[] = [];
      for (let j = 0; j < tElements.length; j++) {
        textParts.push(tElements[j].textContent ?? '');
      }
      if (textParts.length > 0) {
        allParagraphs.push(textParts.join(''));
      }
    }
  }

  return allParagraphs.join('\n');
}

/**
 * Extract raw XML from word/document.xml only (for footnote ref counting).
 */
function extractDocumentXml(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  return entry.getData().toString('utf-8');
}

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import type { NormalizeConfig, FieldSelectorMetadata } from '../metadata.js';
import { parseReplacementKey } from './replacement-keys.js';
import { resolveSelectorContracts, type FieldSelectorManifest } from '../selectors/index.js';

const SHORT_PLACEHOLDER_MAX = 80;

export interface SourceStructureSignature {
  paragraph_count: number;
  heading_like_count: number;
  short_placeholder_count: number;
  long_clause_count: number;
  unique_short_placeholders: string[];
}

export interface SourceDriftDiff {
  missing_replacement_anchor_groups: string[];
  missing_normalize_heading_anchors: string[];
  missing_normalize_paragraph_anchors: string[];
  missing_normalize_paragraph_end_anchors: string[];
  /** Selector fields with at least one occurrence that did not resolve in the source. */
  unresolved_selector_fields: string[];
  /** Human-readable assertion failures (field → kind/detail) from selector resolution. */
  assertion_failures: string[];
}

/** Selector-drift slice resolved against the source DOCX via safe-docx. */
export interface SelectorDriftResult {
  unresolved_selector_fields: string[];
  assertion_failures: string[];
}

/**
 * Resolve every selector field's occurrence locators against the SOURCE DOCX
 * (safe-docx parse path) and report drift: any unresolved occurrence or failed
 * assertion means an upstream change broke a selector. This is the standing
 * "did the form change under us?" gate; it runs at canary time, not fill time.
 */
export async function checkSelectorDrift(
  sourcePath: string,
  manifests: FieldSelectorManifest[],
): Promise<SelectorDriftResult> {
  if (manifests.length === 0) {
    return { unresolved_selector_fields: [], assertion_failures: [] };
  }
  const { fields } = await resolveSelectorContracts(sourcePath, manifests);
  const unresolved: string[] = [];
  const assertionFailures: string[] = [];
  for (const field of fields) {
    if (field.unresolved) unresolved.push(field.field_id);
    for (const failure of field.assertionFailures) {
      assertionFailures.push(
        `${field.field_id}[occ ${failure.occurrenceIndex}] ${failure.kind}: ${failure.detail ?? 'mismatch'}`,
      );
    }
  }
  return {
    unresolved_selector_fields: [...new Set(unresolved)].sort(),
    assertion_failures: assertionFailures.sort(),
  };
}

export interface SourceDriftCheckResult {
  field_selector_id: string;
  source_path: string;
  expected_sha256?: string;
  actual_sha256: string;
  hash_match: boolean;
  structure: SourceStructureSignature;
  diff: SourceDriftDiff;
  ok: boolean;
}

function extractDocumentParagraphs(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return [];
  const xml = entry.getData().toString('utf-8');

  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch: RegExpExecArray | null = null;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const parts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch: RegExpExecArray | null = null;
    while ((tMatch = tRegex.exec(paraXml)) !== null) {
      parts.push(tMatch[1]);
    }
    const text = parts.join('').trimStart();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

function extractBracketTokens(text: string): string[] {
  return [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
}

export function computeSourceStructureSignature(docxPath: string): SourceStructureSignature {
  const paragraphs = extractDocumentParagraphs(docxPath);
  const allBracketTokens = paragraphs.flatMap((paragraph) => extractBracketTokens(paragraph));
  const uniqueShortPlaceholders = [...new Set(
    allBracketTokens
      .filter((token) => token.length <= SHORT_PLACEHOLDER_MAX)
      .map((token) => `[${token}]`)
  )].sort();
  const longClauseCount = allBracketTokens.filter((token) => token.length > SHORT_PLACEHOLDER_MAX).length;

  const headingLikeCount = paragraphs.filter((p) => /^\[[A-Z][^\]]*$/.test(p)).length;

  return {
    paragraph_count: paragraphs.length,
    heading_like_count: headingLikeCount,
    short_placeholder_count: uniqueShortPlaceholders.length,
    long_clause_count: longClauseCount,
    unique_short_placeholders: uniqueShortPlaceholders,
  };
}

function computeSha256Hex(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function checkFieldSelectorSourceDrift(input: {
  fieldSelectorId: string;
  sourcePath: string;
  metadata: FieldSelectorMetadata;
  replacements: Record<string, string>;
  normalizeConfig?: NormalizeConfig;
  /** Pre-computed selector drift (from {@link checkSelectorDrift}); folded into diff + ok. */
  selectorDrift?: SelectorDriftResult;
}): SourceDriftCheckResult {
  const { fieldSelectorId, sourcePath, metadata, replacements, normalizeConfig, selectorDrift } = input;
  const paragraphs = extractDocumentParagraphs(sourcePath);
  const documentText = paragraphs.join('\n');
  const actualSha = computeSha256Hex(sourcePath);
  const hashMatch = metadata.source_sha256 ? metadata.source_sha256 === actualSha : true;

  const replacementGroups = new Map<string, Set<string>>();
  for (const [key, value] of Object.entries(replacements)) {
    const searchText = parseReplacementKey(key, value).searchText;
    if (!replacementGroups.has(value)) {
      replacementGroups.set(value, new Set<string>());
    }
    replacementGroups.get(value)!.add(searchText);
  }

  const missingReplacementGroups: string[] = [];
  for (const anchors of replacementGroups.values()) {
    const anchorList = [...anchors].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const hasAnyAnchor = anchorList.some((anchor) => documentText.includes(anchor));
    if (!hasAnyAnchor) {
      missingReplacementGroups.push(anchorList[0]);
    }
  }

  const missingNormalizeHeadingAnchors = uniqueSorted(
    (normalizeConfig?.paragraph_rules ?? [])
      .filter((rule) => !rule.ignore_heading)
      .filter((rule) => {
        const headingAnchors = [rule.section_heading, ...(rule.section_heading_any ?? [])];
        return !headingAnchors.some((anchor) => documentText.includes(anchor));
      })
      .map((rule) => rule.id)
  );

  const missingNormalizeParagraphAnchors = uniqueSorted(
    (normalizeConfig?.paragraph_rules ?? [])
      .map((rule) => rule.paragraph_contains)
      .filter((anchor) => !documentText.includes(anchor))
  );

  const missingNormalizeParagraphEndAnchors = uniqueSorted(
    (normalizeConfig?.paragraph_rules ?? [])
      .map((rule) => rule.paragraph_end_contains)
      .filter((anchor): anchor is string => typeof anchor === 'string' && anchor.length > 0)
      .filter((anchor) => !documentText.includes(anchor))
  );

  const diff: SourceDriftDiff = {
    missing_replacement_anchor_groups: uniqueSorted(missingReplacementGroups),
    missing_normalize_heading_anchors: missingNormalizeHeadingAnchors,
    missing_normalize_paragraph_anchors: missingNormalizeParagraphAnchors,
    missing_normalize_paragraph_end_anchors: missingNormalizeParagraphEndAnchors,
    unresolved_selector_fields: selectorDrift?.unresolved_selector_fields ?? [],
    assertion_failures: selectorDrift?.assertion_failures ?? [],
  };

  const ok = hashMatch
    && diff.missing_replacement_anchor_groups.length === 0
    && diff.missing_normalize_heading_anchors.length === 0
    && diff.missing_normalize_paragraph_anchors.length === 0
    && diff.missing_normalize_paragraph_end_anchors.length === 0
    && diff.unresolved_selector_fields.length === 0
    && diff.assertion_failures.length === 0;

  return {
    field_selector_id: fieldSelectorId,
    source_path: sourcePath,
    expected_sha256: metadata.source_sha256,
    actual_sha256: actualSha,
    hash_match: hashMatch,
    structure: computeSourceStructureSignature(sourcePath),
    diff,
    ok,
  };
}

import { parseReplacementKey } from '../recipe/replacement-keys.js';

const FIELD_TAG_RE = /\{([a-z_][a-z0-9_]*)\}/g;

export interface ScanMetadataCoverageInput {
  scannedShortPlaceholders: string[];
  metadataFields: string[];
  replacements: Record<string, string>;
  extraCoveredFields?: string[];
  ignoredPlaceholders?: string[];
}

export interface ScanMetadataCoverageReport {
  coveredShortPlaceholders: string[];
  uncoveredShortPlaceholders: string[];
  ignoredShortPlaceholders: string[];
  placeholderToFields: Record<string, string[]>;
  mappedFieldsNotInMetadata: string[];
  metadataFieldsWithoutPlaceholderCoverage: string[];
}

function extractFieldTags(template: string): string[] {
  const out = new Set<string>();
  let match: RegExpExecArray | null = null;
  while ((match = FIELD_TAG_RE.exec(template)) !== null) {
    out.add(match[1]);
  }
  return [...out];
}

/**
 * Compare short placeholders discovered via scan against recipe/template metadata
 * coverage inferred from replacements mapping.
 */
export function assessScanMetadataCoverage(
  input: ScanMetadataCoverageInput
): ScanMetadataCoverageReport {
  const metadataFieldSet = new Set(input.metadataFields);
  const ignored = new Set(input.ignoredPlaceholders ?? []);
  const extraCovered = new Set(input.extraCoveredFields ?? []);

  const placeholderFieldMap = new Map<string, Set<string>>();
  const mappedFieldsNotInMetadata = new Set<string>();

  for (const [key, value] of Object.entries(input.replacements)) {
    const parsed = parseReplacementKey(key, value);
    const searchText = parsed.searchText;
    const tags = extractFieldTags(value);
    if (!placeholderFieldMap.has(searchText)) {
      placeholderFieldMap.set(searchText, new Set<string>());
    }
    const fieldSet = placeholderFieldMap.get(searchText)!;
    for (const tag of tags) {
      fieldSet.add(tag);
      if (!metadataFieldSet.has(tag)) {
        mappedFieldsNotInMetadata.add(tag);
      }
    }
  }

  const coveredShort = new Set<string>();
  const uncoveredShort = new Set<string>();
  const ignoredShort = new Set<string>();
  const coveredFields = new Set<string>(extraCovered);

  for (const placeholder of input.scannedShortPlaceholders) {
    if (ignored.has(placeholder)) {
      ignoredShort.add(placeholder);
      continue;
    }

    const mapped = placeholderFieldMap.get(placeholder);
    if (!mapped || mapped.size === 0) {
      uncoveredShort.add(placeholder);
      continue;
    }

    coveredShort.add(placeholder);
    for (const field of mapped) {
      coveredFields.add(field);
    }
  }

  const placeholderToFields = Object.fromEntries(
    [...placeholderFieldMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([placeholder, fields]) => [placeholder, [...fields].sort()])
  );

  const metadataFieldsWithoutPlaceholderCoverage = [...metadataFieldSet]
    .filter((field) => !coveredFields.has(field))
    .sort();

  return {
    coveredShortPlaceholders: [...coveredShort].sort(),
    uncoveredShortPlaceholders: [...uncoveredShort].sort(),
    ignoredShortPlaceholders: [...ignoredShort].sort(),
    placeholderToFields,
    mappedFieldsNotInMetadata: [...mappedFieldsNotInMetadata].sort(),
    metadataFieldsWithoutPlaceholderCoverage,
  };
}


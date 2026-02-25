import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { load } from 'js-yaml';
import { describe, expect } from 'vitest';
import { BLANK_PLACEHOLDER } from '../src/core/fill-utils.js';
import { runRecipe } from '../src/core/recipe/index.js';
import { extractAllText, verifyOutput } from '../src/core/recipe/verifier.js';
import { runFillPipeline } from '../src/core/unified-pipeline.js';
import { validateRecipe } from '../src/core/validation/recipe.js';
import { validateRecipeMetadata } from '../src/core/metadata.js';
import {
  allureDescriptionHtml,
  allureParameter,
  allureSeverity,
  allureStep,
  itAllure,
  type AllureSeverityLevel,
} from './helpers/allure-test.js';

interface MetadataField {
  name: string;
  type: 'string' | 'date' | 'number' | 'boolean' | 'enum';
  description: string;
  default?: string;
  options?: string[];
}

interface RecipeMetadataDocument {
  source_url?: string;
  source_sha256?: string;
  optional?: boolean;
  fields?: MetadataField[];
  required_fields?: string[];
}

type ReplacementMap = Record<string, string>;

interface CleanConfig {
  removeFootnotes?: boolean;
  removeParagraphPatterns?: string[];
  removeRanges?: Array<{ start: string; end: string }>;
  clearParts?: string[];
}

interface FillRenderScenario {
  id: string;
  sourcePlaceholders: string[];
  overrides?: Record<string, string>;
  omitFields?: string[];
  expectedFragments: string[];
  minimumOccurrences?: Array<{ text: string; count: number }>;
  absentFragments?: string[];
}

type FieldAssertionMode = 'strict' | 'resilient' | 'skip';

interface FieldAssertionPolicy {
  mode: FieldAssertionMode;
  reason?: string;
  normalize?: 'none' | 'lowercase';
}

const RECIPE_ID = 'nvca-stock-purchase-agreement';
const RECIPE_DIR = join(import.meta.dirname, '..', 'content', 'recipes', RECIPE_ID);
const it = itAllure.withLabels({
  epic: 'NVCA SPA Template',
  feature: 'NVCA SPA Legal QA',
  suite: 'Counsel Review',
});
const itDiscovery = it.withLabels({ subSuite: 'Discovery & Metadata' });
const itGovernance = it.withLabels({ subSuite: 'Compliance & Governance' });
const itFilling = it.withLabels({ subSuite: 'Filling & Rendering' });
const itVerification = it.withLabels({ subSuite: 'Verification & Drift' });
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const WORD_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

const DECLARATIVE_FILL_SCENARIOS: FillRenderScenario[] = [
  {
    id: 'defaults-and-blank-placeholder',
    sourcePlaceholders: [
      '[Signature Page Follows]',
      '[monthly]',
      '[insert Plan Year and Name]',
    ],
    omitFields: ['signature_page_marker', 'financial_reporting_period', 'benefit_plan_name'],
    expectedFragments: ['Signature Page Follows', 'monthly', BLANK_PLACEHOLDER],
  },
  {
    id: 'company-name-consistency-across-variants',
    sourcePlaceholders: ['[Insert Company Name]', '[Company name]'],
    overrides: {
      company_name: 'Helios Labs, Inc.',
    },
    expectedFragments: ['Helios Labs, Inc.'],
    minimumOccurrences: [{ text: 'Helios Labs, Inc.', count: 2 }],
  },
];

const FIELD_ASSERTION_POLICY: Record<string, FieldAssertionPolicy> = {
  company_name: { mode: 'strict', reason: 'Primary party identity across variants' },
  investor_name: { mode: 'strict', reason: 'Counterparty identity' },
  company_counsel: { mode: 'resilient', reason: 'Long freeform counsel block' },
  investor_counsel: { mode: 'resilient', reason: 'Long freeform counsel block' },
  company_counsel_name: { mode: 'resilient', reason: 'Name-only variant may evolve in wording' },
  lead_purchaser_name: { mode: 'resilient', reason: 'Name appears in context-sensitive clauses' },
  series_designation: { mode: 'skip', reason: 'Nth-qualified replacement; exercised in real-source integration checks' },
  agreement_date_month_day: { mode: 'skip', reason: 'Nth-qualified replacement; exercised in real-source integration checks' },
  agreement_year_two_digits: { mode: 'skip', reason: 'Nth-qualified replacement; exercised in real-source integration checks' },
  par_value_per_share: { mode: 'skip', reason: 'Nth-qualified replacement; exercised in real-source integration checks' },
  purchase_price_per_share: { mode: 'skip', reason: 'Nth-qualified replacement; exercised in real-source integration checks' },
  applicable_word: { mode: 'skip', reason: 'Control field for optional closing-word bracket cleanup' },
  optional_closing_reference: { mode: 'skip', reason: 'Control field for optional reference bracket cleanup' },
  optional_clause_text: { mode: 'skip', reason: 'Control field for optional alternate clause removal' },
  optional_plural_suffix: { mode: 'skip', reason: 'Control field for optional pluralized headings' },
  closing_heading: { mode: 'strict', reason: 'Single-closing heading should render explicitly' },
  initial_word_lower: { mode: 'strict', reason: 'Single-closing lowercase token should render explicitly' },
  initial_word_title: { mode: 'strict', reason: 'Single-closing titlecase token should render explicitly' },
  dispute_resolution_mode: {
    mode: 'skip',
    reason: 'Computed control input; not rendered directly in template text',
  },
  arbitration_location: { mode: 'strict', reason: 'Alternative 1 arbitration venue placeholder' },
  judicial_district: { mode: 'strict', reason: 'Venue term should remain exact' },
  balance_sheet_date: { mode: 'strict', reason: 'Date anchor should be preserved exactly' },
  benefit_plan_name: { mode: 'skip', reason: 'Optional field; covered in targeted scenario tests' },
  signature_page_marker: { mode: 'strict', reason: 'Execution marker anchor' },
  state_lower: { mode: 'strict', reason: 'Jurisdiction anchor', normalize: 'lowercase' },
  specify_percentage: { mode: 'strict', reason: 'Key negotiated threshold anchor' },
  financial_reporting_period: { mode: 'strict', reason: 'Reporting cadence anchor' },
  director_names: { mode: 'resilient', reason: 'List formatting can vary while still valid' },
  board_size: {
    mode: 'skip',
    reason: 'Rendered through normalize.json post-process clauses, not replacements.json synthetic fixture',
  },
  minimum_shares_initial_closing: {
    mode: 'skip',
    reason: 'Rendered through normalize.json post-process clauses, not replacements.json synthetic fixture',
  },
  applicable_purchasers: { mode: 'resilient', reason: 'List formatting can vary while still valid' },
};

type LawyerRiskTier = 'High' | 'Medium' | 'Low';

interface LawyerReviewContext {
  legalQuestion: string;
  riskTier: LawyerRiskTier;
  whyItMatters: string;
  expectedOutcome: string;
}

const RISK_TIER_TO_SEVERITY: Record<LawyerRiskTier, AllureSeverityLevel> = {
  High: 'critical',
  Medium: 'normal',
  Low: 'minor',
};
const MAX_INLINE_EVIDENCE_CHARS = 12_000;

function riskTierFromMode(mode: FieldAssertionMode): LawyerRiskTier {
  if (mode === 'strict') return 'High';
  if (mode === 'resilient') return 'Medium';
  return 'Low';
}

function htmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\n', '<br/>');
}

function firstLineForMarker(outputText: string, markerNumber: number): string {
  const prefix = `Marker ${markerNumber}:`;
  const line = outputText
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  return line ?? '(line not found)';
}

function renderCounselSummaryHtml(context: LawyerReviewContext): string {
  return [
    '<h3>Counsel Summary</h3>',
    '<ul>',
    `<li><strong>Legal question:</strong> ${htmlEscape(context.legalQuestion)}</li>`,
    `<li><strong>Risk tier:</strong> ${htmlEscape(context.riskTier)}</li>`,
    `<li><strong>Why it matters:</strong> ${htmlEscape(context.whyItMatters)}</li>`,
    `<li><strong>Expected outcome:</strong> ${htmlEscape(context.expectedOutcome)}</li>`,
    '</ul>',
  ].join('');
}

function truncateInlineEvidence(content: string, maxChars = MAX_INLINE_EVIDENCE_CHARS): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n... [truncated ${content.length - maxChars} characters for readability]`;
}

function renderInlineEvidenceHtml(title: string, content: string): string {
  return [
    `<h4>${htmlEscape(title)}</h4>`,
    `<pre>${htmlEscape(truncateInlineEvidence(content))}</pre>`,
  ].join('');
}

function renderJsonEvidenceHtml(title: string, payload: unknown): string {
  return renderInlineEvidenceHtml(title, JSON.stringify(payload, null, 2));
}

function renderTextEvidenceHtml(title: string, content: string): string {
  return renderInlineEvidenceHtml(title, content);
}

function renderClauseEvidenceMatrixHtml(
  sourcePlaceholders: string[],
  replacements: ReplacementMap,
  values: Record<string, string>,
  outputText: string,
  policies?: Record<string, FieldAssertionPolicy>
): string {
  const rows: string[] = [];

  sourcePlaceholders.forEach((placeholder, index) => {
    const replacement = replacements[placeholder];
    const fieldName = replacement ? extractFieldNameFromReplacement(replacement) : null;
    if (!fieldName) return;

    const policy = policies?.[fieldName] ?? { mode: 'resilient' as const };
    const riskTier = riskTierFromMode(policy.mode);
    const expectedValue = values[fieldName] ?? '(blank)';
    const outputLine = firstLineForMarker(outputText, index + 1);
    const normalizedExpected = expectedValue === '(blank)'
      ? expectedValue
      : normalizeByPolicy(expectedValue, policy);
    const normalizedOutputLine = normalizeByPolicy(outputLine, policy);
    const matched = expectedValue === '(blank)'
      ? policy.mode === 'skip'
        ? 'Skip'
        : 'N/A'
      : normalizedOutputLine.includes(normalizedExpected)
        ? 'Yes'
        : 'No';

    rows.push(
      [
        '<tr>',
        `<td>${index + 1}</td>`,
        `<td>${htmlEscape(fieldName)}</td>`,
        `<td>${htmlEscape(policy.mode)}</td>`,
        `<td>${htmlEscape(riskTier)}</td>`,
        `<td>${htmlEscape(placeholder)}</td>`,
        `<td>${htmlEscape(expectedValue)}</td>`,
        `<td>${htmlEscape(outputLine)}</td>`,
        `<td>${htmlEscape(matched)}</td>`,
        '</tr>',
      ].join('')
    );
  });

  return [
    '<h3>Clause Evidence Matrix</h3>',
    '<table border="1" cellspacing="0" cellpadding="4">',
    '<thead><tr><th>#</th><th>Field</th><th>Mode</th><th>Risk Tier</th><th>Source Placeholder</th><th>Expected Value</th><th>Rendered Output Excerpt</th><th>Match</th></tr></thead>',
    '<tbody>',
    ...rows,
    '</tbody>',
    '</table>',
  ].join('');
}

async function applyLawyerReviewContext(
  context: LawyerReviewContext,
  ...additionalSections: string[]
): Promise<void> {
  await allureParameter('audience', 'lawyer');
  await allureParameter('legal_question', context.legalQuestion);
  await allureParameter('risk_tier', context.riskTier);
  await allureSeverity(RISK_TIER_TO_SEVERITY[context.riskTier]);

  const sections = [renderCounselSummaryHtml(context), ...additionalSections];

  await allureDescriptionHtml(sections.join(''));
}

function extractFieldNameFromReplacement(value: string): string | null {
  const match = value.match(/^\{([a-zA-Z0-9_]+)\}$/);
  return match?.[1] ?? null;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function createSyntheticRecipeFixture(sourcePlaceholders: string[]): {
  tempDir: string;
  inputPath: string;
  outputPath: string;
} {
  const tempDir = mkdtempSync(join(tmpdir(), 'nvca-spa-fill-'));
  const inputPath = join(tempDir, 'source.docx');
  const outputPath = join(tempDir, 'filled.docx');

  const paragraphXml = sourcePlaceholders
    .map((placeholder, index) => `<w:p><w:r><w:t>Marker ${index + 1}: ${xmlEscape(placeholder)}</w:t></w:r></w:p>`)
    .join('');

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${paragraphXml}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(ROOT_RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));

  writeFileSync(inputPath, zip.toBuffer());

  return { tempDir, inputPath, outputPath };
}

function loadNvcaRecipeArtifacts(): {
  metadata: RecipeMetadataDocument;
  replacements: ReplacementMap;
  cleanConfig: CleanConfig;
} {
  const metadata = load(readFileSync(join(RECIPE_DIR, 'metadata.yaml'), 'utf-8')) as RecipeMetadataDocument;
  const replacements = JSON.parse(readFileSync(join(RECIPE_DIR, 'replacements.json'), 'utf-8')) as ReplacementMap;
  const cleanConfig = JSON.parse(readFileSync(join(RECIPE_DIR, 'clean.json'), 'utf-8')) as CleanConfig;
  return { metadata, replacements, cleanConfig };
}

function buildScenarioValues(
  fields: MetadataField[],
  overrides: Record<string, string> = {},
  omitFields: string[] = []
): Record<string, string> {
  const omitted = new Set(omitFields);
  const values: Record<string, string> = {};

  for (const field of fields) {
    if (omitted.has(field.name)) continue;
    if (field.name in overrides) {
      values[field.name] = overrides[field.name];
      continue;
    }
    if (field.default !== undefined) {
      values[field.name] = field.default;
      continue;
    }
    values[field.name] = `value_for_${field.name}`;
  }

  for (const [name, value] of Object.entries(overrides)) {
    if (!omitted.has(name)) {
      values[name] = value;
    }
  }

  return values;
}

function buildVerificationValues(
  values: Record<string, string>,
  sourcePlaceholders: string[],
  replacements: ReplacementMap
): Record<string, string> {
  const fieldNames = new Set<string>();
  for (const placeholder of sourcePlaceholders) {
    const replacement = replacements[placeholder];
    if (!replacement) continue;
    const fieldName = extractFieldNameFromReplacement(replacement);
    if (fieldName && values[fieldName] !== undefined) {
      fieldNames.add(fieldName);
    }
  }

  const verificationValues: Record<string, string> = {};
  for (const fieldName of fieldNames) {
    verificationValues[fieldName] = values[fieldName];
  }
  return verificationValues;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function buildPlaceholdersByField(replacements: ReplacementMap): Map<string, string[]> {
  const placeholdersByField = new Map<string, string[]>();

  for (const [placeholder, replacementValue] of Object.entries(replacements)) {
    const fieldName = extractFieldNameFromReplacement(replacementValue);
    if (!fieldName) continue;
    const existing = placeholdersByField.get(fieldName) ?? [];
    existing.push(placeholder);
    placeholdersByField.set(fieldName, existing);
  }

  return placeholdersByField;
}

function isNthReplacementKey(key: string): boolean {
  return /#\d+$/.test(key);
}

function normalizeByPolicy(value: string, policy: FieldAssertionPolicy): string {
  if (policy.normalize === 'lowercase') {
    return value.toLowerCase();
  }
  return value;
}

describe('NVCA SPA Template', () => {
  itDiscovery('Can counsel confirm replacement rules cover required NVCA SPA fields?', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    const fieldAlignmentContext: LawyerReviewContext = {
      legalQuestion: 'Do replacement rules cover each required NVCA SPA field?',
      riskTier: 'High',
      whyItMatters: 'Missing replacement coverage can leave blanks in executed financing documents.',
      expectedOutcome: 'Every required field is mapped and no unknown targets are present.',
    };
    await applyLawyerReviewContext(fieldAlignmentContext);

    const metadata = await allureStep('Load metadata.yaml', () =>
      load(readFileSync(join(RECIPE_DIR, 'metadata.yaml'), 'utf-8')) as RecipeMetadataDocument
    );
    const replacements = await allureStep('Load replacements.json', () =>
      JSON.parse(readFileSync(join(RECIPE_DIR, 'replacements.json'), 'utf-8')) as ReplacementMap
    );
    const normalizeConfig = await allureStep('Load normalize.json', () =>
      JSON.parse(readFileSync(join(RECIPE_DIR, 'normalize.json'), 'utf-8')) as {
        paragraph_rules?: Array<{ replacements?: Record<string, string> }>;
      }
    );

    const metadataFieldNames = (metadata.fields ?? []).map((field) => field.name).sort();
    const requiredFieldNames = (metadata.required_fields ?? []).slice().sort();

    const replacementFieldNames = Object.values(replacements)
      .map(extractFieldNameFromReplacement)
      .filter((field): field is string => field !== null)
      .sort();
    const normalizeFieldNames = (normalizeConfig.paragraph_rules ?? [])
      .flatMap((rule) => Object.values(rule.replacements ?? {}))
      .flatMap((value) =>
        Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((match) => match[1])
      )
      .sort();
    const representedFieldNames = Array.from(new Set([...replacementFieldNames, ...normalizeFieldNames])).sort();

    const unknownReplacementTargets = representedFieldNames.filter(
      (field) => !metadataFieldNames.includes(field)
    );
    const missingRequiredReplacementTargets = requiredFieldNames.filter(
      (field) => !representedFieldNames.includes(field)
    );

    const fieldAlignmentSnapshot = {
      metadataFieldNames,
      replacementFieldNames,
      normalizeFieldNames,
      representedFieldNames,
      requiredFieldNames,
      unknownReplacementTargets,
      missingRequiredReplacementTargets,
    };
    await applyLawyerReviewContext(
      fieldAlignmentContext,
      renderJsonEvidenceHtml('Field Alignment Snapshot', fieldAlignmentSnapshot)
    );

    await allureStep('Assert replacement targets are declared by metadata', () => {
      expect(unknownReplacementTargets).toEqual([]);
    });
    await allureStep('Assert required metadata fields are represented in replacements', () => {
      expect(missingRequiredReplacementTargets).toEqual([]);
    });
  });

  itDiscovery('Can counsel verify the NVCA SPA recipe is structurally valid before use?', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    const structuralValidationContext: LawyerReviewContext = {
      legalQuestion: 'Is the NVCA SPA recipe structurally valid before any fill operation?',
      riskTier: 'Medium',
      whyItMatters: 'Invalid metadata or recipe structure can produce unreliable contract output.',
      expectedOutcome: 'Recipe metadata and recipe validation both pass without errors.',
    };
    await applyLawyerReviewContext(structuralValidationContext);

    const metadataResult = await allureStep('Run validateRecipeMetadata', () =>
      validateRecipeMetadata(RECIPE_DIR)
    );
    const recipeResult = await allureStep('Run validateRecipe', () =>
      validateRecipe(RECIPE_DIR, RECIPE_ID)
    );

    await applyLawyerReviewContext(
      structuralValidationContext,
      renderJsonEvidenceHtml('Metadata Validation Result', metadataResult),
      renderJsonEvidenceHtml('Recipe Validation Result', recipeResult)
    );

    await allureStep('Assert metadata validation passes', () => {
      expect(metadataResult.valid).toBe(true);
      expect(metadataResult.errors).toEqual([]);
    });
    await allureStep('Assert recipe validation passes', () => {
      expect(recipeResult.valid).toBe(true);
      expect(recipeResult.errors).toEqual([]);
    });
  });

  itGovernance('Can counsel verify provenance and cleaning policy are documented?', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    const governanceContext: LawyerReviewContext = {
      legalQuestion: 'Is provenance and cleaning governance explicitly documented?',
      riskTier: 'High',
      whyItMatters: 'Counsel must trace source integrity and drafting-note removal policy.',
      expectedOutcome: 'Source URL/checksum are present and governance cleaning rules are active.',
    };
    await applyLawyerReviewContext(governanceContext);

    const metadata = load(readFileSync(join(RECIPE_DIR, 'metadata.yaml'), 'utf-8')) as RecipeMetadataDocument;
    const cleanConfig = JSON.parse(
      readFileSync(join(RECIPE_DIR, 'clean.json'), 'utf-8')
    ) as CleanConfig;

    await applyLawyerReviewContext(
      governanceContext,
      renderJsonEvidenceHtml('Cleaning Policy (clean.json)', cleanConfig),
      renderTextEvidenceHtml('Source URL', metadata.source_url ?? 'missing'),
      renderTextEvidenceHtml('Source SHA256', metadata.source_sha256 ?? 'missing')
    );

    await allureStep('Assert source URL points to NVCA document', () => {
      expect(metadata.source_url).toMatch(/^https:\/\/nvca\.org\//);
    });
    await allureStep('Assert source checksum uses 64-char SHA256', () => {
      expect(metadata.source_sha256).toMatch(/^[a-f0-9]{64}$/);
    });
    await allureStep('Assert recipe is not optional', () => {
      expect(metadata.optional).toBe(false);
    });
    await allureStep('Assert cleaning removes drafting guidance markers', () => {
      const patterns = cleanConfig.removeParagraphPatterns ?? [];
      expect(cleanConfig.removeFootnotes).toBe(true);
      expect(patterns).toContain('^Note to Drafter:');
      expect(patterns).toContain('^Preliminary Note\\b');
    });
  });

  itFilling('Can counsel confirm full-corpus synthetic rendering replaces mapped placeholders?', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    const fullCorpusContext: LawyerReviewContext = {
      legalQuestion: 'Does full-corpus synthetic rendering replace all mapped placeholders?',
      riskTier: 'High',
      whyItMatters: 'Placeholder leakage into a signing draft is a material execution risk.',
      expectedOutcome: 'Verifier passes and representative key values are rendered in the output.',
    };
    await applyLawyerReviewContext(fullCorpusContext);

    const { metadata, replacements, cleanConfig } = await allureStep('Load NVCA recipe artifacts', () =>
      loadNvcaRecipeArtifacts()
    );
    const sourcePlaceholders = Object.keys(replacements).filter((key) => !isNthReplacementKey(key));
    const values = buildScenarioValues(metadata.fields ?? [], {
      company_name: 'Acme Robotics, Inc.',
      investor_name: 'North Star Ventures LLC',
      judicial_district: 'Northern District of California',
      director_names: 'Jane Founder; Pat Director',
      applicable_purchasers: 'North Star Ventures LLC',
    });
    const verificationValues = buildVerificationValues(values, sourcePlaceholders, replacements);

    const fixture = createSyntheticRecipeFixture(sourcePlaceholders);
    await applyLawyerReviewContext(
      fullCorpusContext,
      renderJsonEvidenceHtml('Full-Corpus Input Values', values),
      renderJsonEvidenceHtml('Full-Corpus Verification Values', verificationValues),
      renderJsonEvidenceHtml('Full-Corpus Source Placeholders', sourcePlaceholders)
    );

    try {
      await allureStep('Run runRecipe using synthetic source DOCX', async () => {
        await runRecipe({
          recipeId: RECIPE_ID,
          inputPath: fixture.inputPath,
          outputPath: fixture.outputPath,
          values,
        });
      });

      const outputText = await allureStep('Extract output text', () => extractAllText(fixture.outputPath));
      const verifyResult = await allureStep('Run recipe verifier against output', () =>
        verifyOutput(fixture.outputPath, verificationValues, replacements, cleanConfig)
      );

      const fullCorpusMatrixHtml = renderClauseEvidenceMatrixHtml(
        sourcePlaceholders,
        replacements,
        values,
        outputText
      );
      await applyLawyerReviewContext(
        fullCorpusContext,
        fullCorpusMatrixHtml,
        renderTextEvidenceHtml('Full-Corpus Rendered Output', outputText),
        renderJsonEvidenceHtml('Full-Corpus Verification Result', verifyResult)
      );

      await allureStep('Assert full synthetic corpus verifies cleanly', () => {
        expect(verifyResult.passed).toBe(true);
      });
      await allureStep('Assert representative values render into output text', () => {
        expect(outputText).toContain('Acme Robotics, Inc.');
        expect(outputText).toContain('North Star Ventures LLC');
        expect(outputText).toContain('Northern District of California');
      });
      await allureStep('Assert source placeholder phrases are removed', () => {
        expect(outputText).not.toContain('[Insert Company Name]');
        expect(outputText).not.toContain('[Insert Investor Name]');
      });
    } finally {
      rmSync(fixture.tempDir, { recursive: true, force: true });
    }
  });

  itVerification('Can counsel rely on stricter checks for high-risk NVCA fields?', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    const policyContext: LawyerReviewContext = {
      legalQuestion: 'Are high-risk legal anchors checked more strictly than low-risk fields?',
      riskTier: 'High',
      whyItMatters: 'Entity names, venue, dates, and thresholds require stronger assurance.',
      expectedOutcome: 'Policy coverage is complete and strict checks enforce anchor rendering quality.',
    };
    await applyLawyerReviewContext(policyContext);

    const { metadata, replacements, cleanConfig } = await allureStep('Load NVCA recipe artifacts', () =>
      loadNvcaRecipeArtifacts()
    );
    const fields = metadata.fields ?? [];
    const metadataFieldNames = fields.map((field) => field.name).sort();
    const policyFieldNames = Object.keys(FIELD_ASSERTION_POLICY).sort();
    const fieldsMissingPolicy = metadataFieldNames.filter((fieldName) => !(fieldName in FIELD_ASSERTION_POLICY));
    const policyWithoutField = policyFieldNames.filter((fieldName) => !metadataFieldNames.includes(fieldName));
    const sourcePlaceholders = Object.keys(replacements).filter((key) => !isNthReplacementKey(key));
    const sourcePlaceholderSet = new Set(sourcePlaceholders);
    const placeholdersByField = buildPlaceholdersByField(replacements);

    await applyLawyerReviewContext(
      policyContext,
      renderJsonEvidenceHtml('Field Assertion Policy Map', FIELD_ASSERTION_POLICY),
      renderJsonEvidenceHtml('Metadata Fields Missing Policy', fieldsMissingPolicy),
      renderJsonEvidenceHtml('Policy Entries Without Metadata Field', policyWithoutField)
    );

    await allureStep('Assert policy covers every metadata field with no stale entries', () => {
      expect(fieldsMissingPolicy).toEqual([]);
      expect(policyWithoutField).toEqual([]);
    });

    const values = buildScenarioValues(fields, {
      company_name: 'Acme Robotics, Inc.',
      investor_name: 'North Star Ventures LLC',
      judicial_district: 'Northern District of California',
      state_lower: 'delaware',
      balance_sheet_date: '2025-12-31',
      specify_percentage: '12%',
      director_names: 'Jane Founder; Pat Director',
      applicable_purchasers: 'North Star Ventures LLC',
    });
    const verificationValues = buildVerificationValues(values, sourcePlaceholders, replacements);
    const fixture = createSyntheticRecipeFixture(sourcePlaceholders);
    await applyLawyerReviewContext(
      policyContext,
      renderJsonEvidenceHtml('Policy Scenario Input Values', values),
      renderJsonEvidenceHtml('Policy Scenario Verification Values', verificationValues)
    );

    try {
      await allureStep('Run runRecipe against synthetic full-corpus source', async () => {
        await runRecipe({
          recipeId: RECIPE_ID,
          inputPath: fixture.inputPath,
          outputPath: fixture.outputPath,
          values,
        });
      });

      const outputText = await allureStep('Extract rendered text', () => extractAllText(fixture.outputPath));
      const verifyResult = await allureStep('Verify output consistency', () =>
        verifyOutput(fixture.outputPath, verificationValues, replacements, cleanConfig)
      );

      const policyMatrixHtml = renderClauseEvidenceMatrixHtml(
        sourcePlaceholders,
        replacements,
        values,
        outputText,
        FIELD_ASSERTION_POLICY
      );
      await applyLawyerReviewContext(
        policyContext,
        policyMatrixHtml,
        renderTextEvidenceHtml('Policy Scenario Rendered Output', outputText),
        renderJsonEvidenceHtml('Policy Scenario Verification Result', verifyResult)
      );

      await allureStep('Assert verifier passes before policy checks', () => {
        expect(verifyResult.passed).toBe(true);
      });

      for (const field of fields) {
        const policy = FIELD_ASSERTION_POLICY[field.name];
        const value = values[field.name];
        const placeholders = (placeholdersByField.get(field.name) ?? []).filter((placeholder) =>
          sourcePlaceholderSet.has(placeholder)
        );
        const normalizedExpected = value ? normalizeByPolicy(value, policy) : '';
        const normalizedOutput = normalizeByPolicy(outputText, policy);

        await allureStep(`Policy check for field "${field.name}" (${policy.mode})`, () => {
          if (policy.mode === 'skip') {
            expect(policy.reason).toBeDefined();
            return;
          }

          expect(value).toBeDefined();
          expect(normalizedOutput).toContain(normalizedExpected);

          if (policy.mode === 'resilient') {
            expect(countOccurrences(normalizedOutput, normalizedExpected)).toBeGreaterThanOrEqual(1);
            return;
          }

          if (placeholders.length === 0) {
            expect(countOccurrences(normalizedOutput, normalizedExpected)).toBeGreaterThanOrEqual(1);
            return;
          }
          expect(countOccurrences(normalizedOutput, normalizedExpected)).toBeGreaterThanOrEqual(
            placeholders.length
          );
          for (const placeholder of placeholders) {
            expect(outputText).not.toContain(placeholder);
          }
        });
      }
    } finally {
      rmSync(fixture.tempDir, { recursive: true, force: true });
    }
  });

  itVerification.openspec('OA-FIL-002')(
    'computes dispute-resolution forum defaults and governing-law alignment in exported artifact',
    async () => {
      await allureParameter('recipe_id', RECIPE_ID);
      const computedContext: LawyerReviewContext = {
        legalQuestion: 'Do dispute-resolution mode and forum state deterministically derive district defaults and alignment against governing law?',
        riskTier: 'High',
        whyItMatters: 'Interacting legal parameters must produce auditable, deterministic derived state.',
        expectedOutcome: 'Computed artifact records courts/arbitration branch selection, district defaults, and forum/governing-law alignment.',
      };
      await applyLawyerReviewContext(computedContext);

      const fixture = createSyntheticRecipeFixture([
        '[Insert Company Name]',
        '[state]',
        '[judicial district]',
        '[location]',
      ]);
      const computedOutPath = join(fixture.tempDir, 'computed-artifact.json');

      try {
        const runResult = await allureStep('Run recipe with computed artifact output', () =>
          runRecipe({
            recipeId: RECIPE_ID,
            inputPath: fixture.inputPath,
            outputPath: fixture.outputPath,
            values: {
              company_name: 'Helios Labs, Inc.',
              dispute_resolution_mode: 'courts',
              state_lower: 'california',
            },
            computedOutPath,
          })
        );

        const outputText = await allureStep('Extract rendered output text', () =>
          extractAllText(fixture.outputPath)
        );
        const computedArtifact = await allureStep('Read computed artifact JSON', () =>
          JSON.parse(readFileSync(computedOutPath, 'utf-8')) as Record<string, unknown>
        );
        const passTrace = (computedArtifact.passes as Array<Record<string, unknown>>) ?? [];
        const matchedRuleIds = passTrace
          .flatMap((pass) => (pass.rules as Array<Record<string, unknown>>) ?? [])
          .filter((rule) => rule.matched === true)
          .map((rule) => String(rule.rule_id));

        await applyLawyerReviewContext(
          computedContext,
          renderTextEvidenceHtml('Computed Pipeline Output Excerpt', outputText),
          renderJsonEvidenceHtml('Computed Artifact', computedArtifact),
          renderJsonEvidenceHtml('Matched Rule IDs', matchedRuleIds)
        );

        await allureStep('Assert recipe emits computed artifact in run result', () => {
          expect(runResult.computedOutPath).toBe(computedOutPath);
          expect(runResult.computedArtifact?.profile_present).toBe(true);
        });

        await allureStep('Assert dispute-resolution and governing-law derived outputs', () => {
          expect(computedArtifact.profile_present).toBe(true);
          expect(computedArtifact.derived_audit_values).toMatchObject({
            dispute_resolution_track: 'courts',
            governing_law_state: 'delaware',
            forum_governing_law_alignment: 'mismatch',
          });
          expect(computedArtifact.derived_fill_values).toMatchObject({
            judicial_district: 'Northern District of California',
          });
        });

        await allureStep('Assert dependency chain is reflected in matched rules', () => {
          expect(matchedRuleIds).toContain('derive-dispute-resolution-track-courts');
          expect(matchedRuleIds).toContain('derive-judicial-district-default-california');
          expect(matchedRuleIds).toContain('derive-governing-law-baseline');
          expect(matchedRuleIds).toContain('derive-forum-governing-mismatch');
        });

        await allureStep('Assert computed fill values affect rendered output', () => {
          expect(outputText).toContain('Helios Labs, Inc.');
          expect(outputText).toContain('california');
          expect(outputText).toContain('Northern District of California');
        });
      } finally {
        rmSync(fixture.tempDir, { recursive: true, force: true });
      }
    }
  );

  for (const scenario of DECLARATIVE_FILL_SCENARIOS) {
    itFilling(`Can counsel review declarative scenario: ${scenario.id}`, async () => {
      await allureParameter('recipe_id', RECIPE_ID);
      await allureParameter('scenario_id', scenario.id);
      const scenarioContext: LawyerReviewContext = {
        legalQuestion: `Does declarative scenario "${scenario.id}" render as expected?`,
        riskTier: 'Medium',
        whyItMatters: 'Scenario-level checks make expected legal output behavior explicit to reviewers.',
        expectedOutcome: 'Scenario expectations and verifier checks pass with inline evidence visible in Allure.',
      };
      await applyLawyerReviewContext(scenarioContext);

      const { metadata, replacements, cleanConfig } = await allureStep('Load NVCA recipe artifacts', () =>
        loadNvcaRecipeArtifacts()
      );
      const missingPlaceholders = scenario.sourcePlaceholders.filter(
        (placeholder) => !(placeholder in replacements)
      );
      await applyLawyerReviewContext(
        scenarioContext,
        renderJsonEvidenceHtml('Scenario Definition', scenario),
        renderJsonEvidenceHtml('Scenario Missing Placeholders', missingPlaceholders)
      );

      await allureStep('Assert declarative placeholder list maps to replacements.json', () => {
        expect(missingPlaceholders).toEqual([]);
      });

      const values = buildScenarioValues(
        metadata.fields ?? [],
        scenario.overrides ?? {},
        scenario.omitFields ?? []
      );
      const verificationValues = buildVerificationValues(values, scenario.sourcePlaceholders, replacements);
      const fixture = createSyntheticRecipeFixture(scenario.sourcePlaceholders);
      await applyLawyerReviewContext(
        scenarioContext,
        renderJsonEvidenceHtml('Scenario Fill Values', values),
        renderJsonEvidenceHtml('Scenario Verification Values', verificationValues)
      );

      try {
        await allureStep('Run runFillPipeline with NVCA clean/patch configuration', async () => {
          await runFillPipeline({
            inputPath: fixture.inputPath,
            outputPath: fixture.outputPath,
            values,
            fields: metadata.fields ?? [],
            cleanPatch: { cleanConfig, replacements },
            verify: () => ({
              passed: true,
              checks: [{ name: 'Synthetic fixture post-check', passed: true }],
            }),
          });
        });

        const outputText = await allureStep('Extract output text', () => extractAllText(fixture.outputPath));
        const verifyResult = await allureStep('Run verifier on scenario-relevant values', () =>
          verifyOutput(fixture.outputPath, verificationValues, replacements, cleanConfig)
        );

        const scenarioMatrixHtml = renderClauseEvidenceMatrixHtml(
          scenario.sourcePlaceholders,
          replacements,
          values,
          outputText,
          FIELD_ASSERTION_POLICY
        );
        await applyLawyerReviewContext(
          scenarioContext,
          scenarioMatrixHtml,
          renderTextEvidenceHtml('Scenario Rendered Output', outputText),
          renderJsonEvidenceHtml('Scenario Verification Result', verifyResult)
        );

        await allureStep('Assert scenario output passes verifier checks', () => {
          expect(verifyResult.passed).toBe(true);
          const leftoverCheck = verifyResult.checks.find(
            (check) => check.name === 'No leftover source placeholders'
          );
          expect(leftoverCheck?.passed).toBe(true);
        });

        await allureStep('Assert expected scenario fragments render into output', () => {
          for (const expectedFragment of scenario.expectedFragments) {
            expect(outputText).toContain(expectedFragment);
          }
          for (const absentFragment of scenario.absentFragments ?? []) {
            expect(outputText).not.toContain(absentFragment);
          }
        });

        await allureStep('Assert minimum occurrence constraints (if any)', () => {
          for (const occurrenceCheck of scenario.minimumOccurrences ?? []) {
            expect(countOccurrences(outputText, occurrenceCheck.text)).toBeGreaterThanOrEqual(
              occurrenceCheck.count
            );
          }
        });
      } finally {
        rmSync(fixture.tempDir, { recursive: true, force: true });
      }
    });
  }
});

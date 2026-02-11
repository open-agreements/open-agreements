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
  allureAttachment,
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface MetadataField {
  name: string;
  type: 'string' | 'date' | 'number' | 'boolean' | 'enum';
  description: string;
  required?: boolean;
  default?: string;
  options?: string[];
}

interface RecipeMetadataDocument {
  source_url?: string;
  source_sha256?: string;
  optional?: boolean;
  fields?: MetadataField[];
}

interface SchemaField {
  name: string;
}

interface RecipeSchemaDocument {
  fields?: SchemaField[];
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

const RECIPE_ID = 'nvca-stock-purchase-agreement';
const RECIPE_DIR = join(import.meta.dirname, '..', 'recipes', RECIPE_ID);
const it = itAllure.epic('NVCA SPA Template');
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

describe('NVCA SPA Template', () => {
  it('keeps metadata, schema, and replacements aligned', async () => {
    await allureParameter('recipe_id', RECIPE_ID);

    const metadata = await allureStep('Load metadata.yaml', () =>
      load(readFileSync(join(RECIPE_DIR, 'metadata.yaml'), 'utf-8')) as RecipeMetadataDocument
    );
    const schema = await allureStep('Load schema.json', () =>
      JSON.parse(readFileSync(join(RECIPE_DIR, 'schema.json'), 'utf-8')) as RecipeSchemaDocument
    );
    const replacements = await allureStep('Load replacements.json', () =>
      JSON.parse(readFileSync(join(RECIPE_DIR, 'replacements.json'), 'utf-8')) as ReplacementMap
    );

    const metadataFieldNames = (metadata.fields ?? []).map((field) => field.name).sort();
    const requiredFieldNames = (metadata.fields ?? [])
      .filter((field) => field.required !== false)
      .map((field) => field.name)
      .sort();
    const schemaFieldNames = (schema.fields ?? []).map((field) => field.name).sort();

    const replacementFieldNames = Object.values(replacements)
      .map(extractFieldNameFromReplacement)
      .filter((field): field is string => field !== null)
      .sort();

    const unknownReplacementTargets = replacementFieldNames.filter(
      (field) => !schemaFieldNames.includes(field)
    );
    const missingRequiredReplacementTargets = requiredFieldNames.filter(
      (field) => !replacementFieldNames.includes(field)
    );

    await allureJsonAttachment('nvca-spa-field-alignment.json', {
      metadataFieldNames,
      schemaFieldNames,
      replacementFieldNames,
      requiredFieldNames,
      unknownReplacementTargets,
      missingRequiredReplacementTargets,
    });

    await allureStep('Assert metadata fields exactly match schema fields', () => {
      expect(metadataFieldNames).toEqual(schemaFieldNames);
    });
    await allureStep('Assert replacement targets are declared by schema', () => {
      expect(unknownReplacementTargets).toEqual([]);
    });
    await allureStep('Assert required metadata fields are represented in replacements', () => {
      expect(missingRequiredReplacementTargets).toEqual([]);
    });
  });

  it('validates recipe metadata and recipe structure', async () => {
    await allureParameter('recipe_id', RECIPE_ID);

    const metadataResult = await allureStep('Run validateRecipeMetadata', () =>
      validateRecipeMetadata(RECIPE_DIR)
    );
    const recipeResult = await allureStep('Run validateRecipe', () =>
      validateRecipe(RECIPE_DIR, RECIPE_ID)
    );

    await allureJsonAttachment('nvca-spa-validate-metadata-result.json', metadataResult);
    await allureJsonAttachment('nvca-spa-validate-recipe-result.json', recipeResult);

    await allureStep('Assert metadata validation passes', () => {
      expect(metadataResult.valid).toBe(true);
      expect(metadataResult.errors).toEqual([]);
    });
    await allureStep('Assert recipe validation passes', () => {
      expect(recipeResult.valid).toBe(true);
      expect(recipeResult.errors).toEqual([]);
    });
  });

  it('captures governance-critical metadata and cleaning defaults', async () => {
    await allureParameter('recipe_id', RECIPE_ID);

    const metadata = load(readFileSync(join(RECIPE_DIR, 'metadata.yaml'), 'utf-8')) as RecipeMetadataDocument;
    const cleanConfig = JSON.parse(
      readFileSync(join(RECIPE_DIR, 'clean.json'), 'utf-8')
    ) as CleanConfig;

    await allureJsonAttachment('nvca-spa-clean-config.json', cleanConfig);
    await allureAttachment('nvca-spa-source-url.txt', metadata.source_url ?? 'missing');
    await allureAttachment('nvca-spa-source-sha256.txt', metadata.source_sha256 ?? 'missing');

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

  it('runs synthetic end-to-end fill-render across the full NVCA placeholder corpus', async () => {
    await allureParameter('recipe_id', RECIPE_ID);

    const { metadata, replacements, cleanConfig } = await allureStep('Load NVCA recipe artifacts', () =>
      loadNvcaRecipeArtifacts()
    );
    const sourcePlaceholders = Object.keys(replacements);
    const values = buildScenarioValues(metadata.fields ?? [], {
      company_name: 'Acme Robotics, Inc.',
      investor_name: 'North Star Ventures LLC',
      judicial_district: 'Northern District of California',
      director_names: 'Jane Founder; Pat Director',
      applicable_purchasers: 'North Star Ventures LLC',
    });

    const fixture = createSyntheticRecipeFixture(sourcePlaceholders);
    await allureJsonAttachment('nvca-spa-full-corpus-values.json', values);
    await allureJsonAttachment('nvca-spa-full-corpus-placeholders.json', sourcePlaceholders);

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
        verifyOutput(fixture.outputPath, values, replacements, cleanConfig)
      );

      await allureAttachment('nvca-spa-full-corpus-output.txt', outputText);
      await allureJsonAttachment('nvca-spa-full-corpus-verify.json', verifyResult);

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

  for (const scenario of DECLARATIVE_FILL_SCENARIOS) {
    it(`renders declarative fill scenario: ${scenario.id}`, async () => {
      await allureParameter('recipe_id', RECIPE_ID);
      await allureParameter('scenario_id', scenario.id);

      const { metadata, replacements, cleanConfig } = await allureStep('Load NVCA recipe artifacts', () =>
        loadNvcaRecipeArtifacts()
      );
      const missingPlaceholders = scenario.sourcePlaceholders.filter(
        (placeholder) => !(placeholder in replacements)
      );

      await allureJsonAttachment(`${scenario.id}-scenario.json`, scenario);
      await allureJsonAttachment(`${scenario.id}-missing-placeholders.json`, missingPlaceholders);

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

      await allureJsonAttachment(`${scenario.id}-values.json`, values);
      await allureJsonAttachment(`${scenario.id}-verification-values.json`, verificationValues);

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

        await allureAttachment(`${scenario.id}-output.txt`, outputText);
        await allureJsonAttachment(`${scenario.id}-verify.json`, verifyResult);

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

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fillTemplate, type FillResult } from './engine.js';
import { loadMetadata, type FieldDefinition, type TemplateMetadata } from './metadata.js';

const APAP_NS = 'org.accordproject.protocol@1.0.0';
const APAP_CICERO_RANGE = '^2.0.0';

export interface ApapCtoFile {
  $class: `${typeof APAP_NS}.CtoFile`;
  filename: string;
  contents: string;
}

export interface ApapTemplatePayload {
  $class: `${typeof APAP_NS}.Template`;
  uri: string;
  author: string;
  displayName: string;
  version: string;
  description: string;
  license: string;
  keywords: string[];
  metadata: {
    $class: `${typeof APAP_NS}.TemplateMetadata`;
    runtime: string;
    template: string;
    cicero: string;
  };
  templateModel: {
    $class: `${typeof APAP_NS}.TemplateModel`;
    typeName: string;
    model: {
      $class: `${typeof APAP_NS}.CtoModel`;
      ctoFiles: ApapCtoFile[];
    };
  };
  text: {
    $class: `${typeof APAP_NS}.Text`;
    templateText: string;
  };
}

export interface ExportApapTemplateOptions {
  templateDir: string;
  concertoModelPath: string;
  concertoDependencyPaths?: string[];
  templateUri?: string;
}

export interface ApapAgreementDataOptions {
  contractId: string;
  values: Record<string, unknown>;
}

export interface FillApapAgreementOptions {
  templateDir: string;
  agreementData: Record<string, unknown>;
  outputPath: string;
}

/**
 * Serialize an APAP Template as the Concerto relationship value required by
 * Agreement.template. The template's URI is the relationship identifier; a
 * bare URI is not a valid relationship value for the APAP protocol model.
 */
export function toApapTemplateRelationship(template: Pick<ApapTemplatePayload, '$class' | 'uri'>): string {
  return `resource:${template.$class}#${template.uri}`;
}

function extractNamespaceAndType(cto: string): { namespace: string; typeName: string } {
  const namespace = /^namespace\s+([^\s]+)$/m.exec(cto)?.[1];
  const declaration = /^(?:asset|concept)\s+([A-Za-z_][A-Za-z0-9_]*)\s+extends\s+Contract\b/m.exec(cto)?.[1];
  if (!namespace || !declaration) {
    throw new Error('Concerto model must declare a namespace and a type extending Contract');
  }
  return { namespace, typeName: `${namespace}.${declaration}` };
}

function stripFrontmatter(source: string): string {
  if (!source.startsWith('---\n')) return source;
  const end = source.indexOf('\n---\n', 4);
  if (end < 0) throw new Error('Canonical template has unterminated YAML frontmatter');
  return source.slice(end + 5);
}

function parseAttributes(raw: string): Record<string, string> {
  return Object.fromEntries(
    [...raw.matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)].map((match) => [match[1], match[2]]),
  );
}

function convertInlineDirectives(line: string): string {
  const convertedFields = line.replace(
    /\{%\s*field\s+name="([^"]+)"\s*\/%\}/g,
    (_match, field: string) => `{{${field}}}`,
  );
  const withoutSemanticAnnotations = convertedFields.replace(
    /\{%\s*\/?requirement(?:\s+[^%]*?)?\s*%\}/g,
    '',
  );
  const unsupported = /\{%\s*\/?([a-z-]+)/i.exec(withoutSemanticAnnotations)?.[1];
  if (unsupported) throw new Error(`Unsupported inline canonical MDoc directive: ${unsupported}`);
  return withoutSemanticAnnotations;
}

/**
 * Convert the structural subset of canonical MDoc into the TemplateMark text
 * accepted by the APAP reference implementation. Requirement annotations are
 * provenance metadata rather than rendered text, so they are removed while
 * their enclosed operative language is retained. Unknown directives fail
 * closed so future canonical constructs cannot be silently omitted.
 */
export function canonicalMdocToApapTemplateMark(
  source: string,
  booleanConditionFields: ReadonlySet<string> = new Set(),
): string {
  const stack: Array<{ name: string; condition?: string }> = [];
  const output: string[] = [];

  for (const originalLine of stripFrontmatter(source).split(/\r?\n/)) {
    const tag = /^\s*\{%\s*(\/)?([a-z-]+)(.*?)%\}\s*$/.exec(originalLine);
    if (!tag || tag[2] === 'field' || tag[2] === 'requirement') {
      output.push(convertInlineDirectives(originalLine));
      continue;
    }

    const [, closing, name, rawAttributes] = tag;
    const attributes = parseAttributes(rawAttributes);

    if (closing) {
      const open = stack.pop();
      if (!open || open.name !== name) {
        throw new Error(`Unbalanced canonical MDoc directive: ${originalLine.trim()}`);
      }
      if (open.condition) output.push('{{/if}}');
      continue;
    }

    if (name === 'cover-term') {
      if (!attributes.label || !attributes.field) {
        throw new Error(`cover-term requires label and field: ${originalLine.trim()}`);
      }
      const rendered = `**${attributes.label}:** {{${attributes.field}}}`;
      if (attributes['include-when'] && booleanConditionFields.has(attributes['include-when'])) {
        output.push(`{{#if ${attributes['include-when']}}}\n${rendered}\n{{/if}}`);
      } else {
        output.push(rendered);
      }
      continue;
    }

    if (!['agreement-section', 'cover-terms', 'clause', 'signature-block', 'signer'].includes(name)) {
      throw new Error(`Unsupported canonical MDoc directive: ${name}`);
    }

    const requestedCondition = attributes['include-when'];
    const condition = requestedCondition && booleanConditionFields.has(requestedCondition)
      ? requestedCondition
      : undefined;
    stack.push({ name, ...(condition ? { condition } : {}) });
    if (condition) output.push(`{{#if ${condition}}}`);
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed canonical MDoc directive: ${stack.at(-1)?.name}`);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function assertEligible(metadata: TemplateMetadata, templateDir: string): void {
  const templateId = basename(templateDir);
  if (!templateId.startsWith('openagreements-')) {
    throw new Error('APAP export is limited to OpenAgreements-authored templates');
  }
  if (!metadata.allow_derivatives) throw new Error('APAP export requires allow_derivatives: true');
  if (!metadata.attribution_text) throw new Error('APAP export requires attribution_text');
}

function assertModelCoversCanonicalFields(cto: string, fields: FieldDefinition[]): void {
  const missing = fields
    .map((field) => field.name)
    .filter((name) => !new RegExp(`\\bo\\s+[^\\n]+\\s+${name}(?:\\s|$)`).test(cto));
  if (missing.length > 0) {
    throw new Error(`Concerto model is missing canonical fields: ${missing.join(', ')}`);
  }
}

function apapRequiredModel(cto: string, fields: FieldDefinition[]): string {
  let result = apapCompatibleCto(cto);
  if (!/^@template\s*$/m.test(result)) {
    result = result.replace(/^(asset\s+[^\n]+\s+extends\s+Contract\s*\{)/m, '@template\n$1');
  }
  for (const field of fields) {
    result = result.replace(new RegExp(`(\\bo\\s+[^\\n]+\\s+${field.name})\\s+optional\\b`), '$1');
  }
  return result;
}

/**
 * Normalize the legacy Accord contract model bundled by OpenAgreements to the
 * versioned namespace required by current Concerto. Keep this transformation
 * at the APAP export boundary: the source models are also consumed by the
 * repository's Concerto 3 generation workflow and are not APAP projections.
 */
function apapCompatibleCto(cto: string): string {
  return cto
    .replace(
      /\bimport org\.accordproject\.contract\.Contract from https:\/\/models\.accordproject\.org\/accordproject\/contract\.cto\b/,
      'import org.accordproject.contract@0.2.0.Contract from https://models.accordproject.org/accordproject/contract@0.2.0.cto',
    )
    .replace(/^namespace org\.accordproject\.contract$/m, 'namespace org.accordproject.contract@0.2.0');
}

function apapSemver(version: string): string {
  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) return version;
  if (/^\d+\.\d+$/.test(version)) return `${version}.0`;
  if (/^\d+$/.test(version)) return `${version}.0.0`;
  throw new Error(`OpenAgreements version cannot be normalized to APAP semver: ${version}`);
}

function apapIdentifierVersion(version: string): string {
  return apapSemver(version).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

export function exportTemplateToApap(options: ExportApapTemplateOptions): ApapTemplatePayload {
  const metadata = loadMetadata(options.templateDir);
  assertEligible(metadata, options.templateDir);
  const mdocPath = join(options.templateDir, 'template.mdoc');
  if (!existsSync(mdocPath)) throw new Error('APAP export requires canonical template.mdoc source');

  const concerto = readFileSync(options.concertoModelPath, 'utf8');
  assertModelCoversCanonicalFields(concerto, metadata.fields);
  const { typeName } = extractNamespaceAndType(concerto);
  const templateId = basename(options.templateDir);
  const ctoFiles: ApapCtoFile[] = [{
    $class: `${APAP_NS}.CtoFile` as const,
    filename: basename(options.concertoModelPath),
    contents: apapRequiredModel(concerto, metadata.fields),
  }, ...(options.concertoDependencyPaths ?? []).map((path) => ({
    $class: `${APAP_NS}.CtoFile` as const,
    filename: basename(path),
    contents: apapCompatibleCto(readFileSync(path, 'utf8')),
  }))];

  return {
    $class: `${APAP_NS}.Template`,
    uri: options.templateUri ?? `openagreements://templates/${templateId}-v${apapIdentifierVersion(metadata.version)}`,
    author: 'OpenAgreements contributors',
    displayName: metadata.name,
    version: apapSemver(metadata.version),
    description: [metadata.description, metadata.attribution_text, `Canonical source: ${metadata.source_url}`]
      .filter(Boolean).join('\n\n'),
    license: metadata.license,
    keywords: ['OpenAgreements', metadata.category, 'legal-template'].filter(
      (value): value is string => typeof value === 'string',
    ),
    metadata: {
      $class: `${APAP_NS}.TemplateMetadata`,
      runtime: 'typescript',
      template: 'contract',
      cicero: APAP_CICERO_RANGE,
    },
    templateModel: {
      $class: `${APAP_NS}.TemplateModel`,
      typeName,
      model: { $class: `${APAP_NS}.CtoModel`, ctoFiles },
    },
    text: {
      $class: `${APAP_NS}.Text`,
      templateText: canonicalMdocToApapTemplateMark(
        readFileSync(mdocPath, 'utf8'),
        new Set(metadata.fields.filter((field) => field.type === 'boolean').map((field) => field.name)),
      ),
    },
  };
}

function concertoEnumValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

export function toApapAgreementData(
  template: ApapTemplatePayload,
  metadata: TemplateMetadata,
  options: ApapAgreementDataOptions,
): Record<string, unknown> {
  const fields = new Map(metadata.fields.map((field) => [field.name, field]));
  const data: Record<string, unknown> = {
    $class: template.templateModel.typeName,
    $identifier: options.contractId,
    contractId: options.contractId,
  };
  const missing = metadata.fields
    .filter((field) => options.values[field.name] === undefined && field.default === undefined)
    .map((field) => field.name);
  if (missing.length > 0) throw new Error(`APAP agreement data is missing fields: ${missing.join(', ')}`);

  for (const field of metadata.fields) {
    const supplied = options.values[field.name];
    let value = supplied ?? field.default;
    if (value === undefined) continue;
    if (supplied === undefined && field.type === 'boolean') value = value === 'true';
    if (supplied === undefined && field.type === 'number') value = Number(value);
    data[field.name] = field.type === 'enum' && typeof value === 'string'
      ? concertoEnumValue(value)
      : value;
  }
  for (const key of Object.keys(options.values)) {
    if (!fields.has(key)) throw new Error(`Unknown OpenAgreements field: ${key}`);
  }
  return data;
}

export async function fillApapAgreementToDocx(options: FillApapAgreementOptions): Promise<FillResult> {
  const metadata = loadMetadata(options.templateDir);
  const values: Record<string, unknown> = {};
  for (const field of metadata.fields) {
    const value = options.agreementData[field.name];
    if (value === undefined) continue;
    if (field.type === 'enum' && typeof value === 'string' && field.options) {
      values[field.name] = field.options.find((option) => concertoEnumValue(option) === value) ?? value;
    } else {
      values[field.name] = value;
    }
  }
  return fillTemplate({ templateDir: options.templateDir, values, outputPath: resolve(options.outputPath) });
}

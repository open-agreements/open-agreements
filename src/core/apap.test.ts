import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { withRequiredSampleValues } from '../../integration-tests/helpers/apap-sample-values.js';
import { loadMetadata } from './metadata.js';
import yaml from 'js-yaml';
import {
  canonicalMdocToApapTemplateMark,
  exportTemplateToApap,
  fillApapAgreementToDocx,
  toApapTemplateRelationship,
  toApapAgreementData,
} from './apap.js';

const ROOT = resolve(import.meta.dirname, '../..');
const TEMPLATE_ID = 'openagreements-confidentiality-invention-assignment-agreement';
const TEMPLATE_DIR = join(ROOT, 'templates/openagreements-cc-by-4.0', TEMPLATE_ID);
const MODEL_PATH = join(ROOT, 'concerto/openagreements-employee-ip-inventions-assignment.cto');
const CONTRACT_MODEL_PATH = join(ROOT, 'concerto/deps/@models.accordproject.org.accordproject.contract.cto');
const it = itAllure.epic('Platform & Distribution');

function templateWithExtraFields(fields: Array<Record<string, unknown>>): string {
  const templateDir = join(mkdtempSync(join(tmpdir(), 'oa-apap-fields-')), TEMPLATE_ID);
  cpSync(TEMPLATE_DIR, templateDir, { recursive: true });
  const metadataPath = join(templateDir, 'metadata.yaml');
  const raw = yaml.load(readFileSync(metadataPath, 'utf8')) as { fields: Array<Record<string, unknown>> };
  raw.fields.push(...fields);
  writeFileSync(metadataPath, yaml.dump(raw, { lineWidth: -1 }));
  return templateDir;
}

function modelFileWith(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'oa-apap-model-')), 'model.cto');
  writeFileSync(path, contents);
  return path;
}

const VALUES = {
  company_name: 'Example Labs, Inc.',
  company_signatory_name: 'Alex Smith',
  company_signatory_title: 'President',
  employee_name: 'Taylor Jones',
  effective_date: '2026-08-11',
  prior_inventions_disclosure: 'None',
  excluded_inventions_statement: 'Personal projects listed on Schedule A are excluded.',
  return_of_materials_timing: 'within five business days after termination',
  post_termination_assistance: 'reasonable assistance on reasonable notice',
  governing_law: 'New York',
  venue: 'state and federal courts located in New York County, New York',
};

describe('APAP interoperability — OpenAgreements CIIAA pilot', () => {
  it('converts canonical MDoc while retaining requirement text', () => {
    const source = readFileSync(join(TEMPLATE_DIR, 'template.mdoc'), 'utf8');
    const text = canonicalMdocToApapTemplateMark(source);
    expect(text).toContain('**Company:** {{company_name}}');
    expect(text).toContain('Employee hereby assigns, and agrees to assign, to Company');
    expect(text).toContain('Signatory Name: {{company_signatory_name}}');
    expect(text).not.toContain('{% agreement-section');
    expect(text).not.toContain('{% requirement');
  });

  it('exports an attributed APAP Template with a derived strict model', () => {
    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const templateMetadata = loadMetadata(TEMPLATE_DIR);
    expect(templateMetadata.version).toMatch(/^\d+\.\d+(\.\d+)?$/);
    expect(template.uri).toBe(
      `openagreements://templates/${TEMPLATE_ID}-v${templateMetadata.version.replaceAll('.', '-')}`,
    );
    expect(template.author).toBe('OpenAgreements contributors');
    expect(template.version).toBe(templateMetadata.version);
    expect(template.license).toBe('CC-BY-4.0');
    expect(template.metadata.cicero).toBe('^2.0.0');
    expect(template.description).toContain('Authored by OpenAgreements contributors');
    expect(template.templateModel.model.ctoFiles).toHaveLength(2);
    const model = template.templateModel.model.ctoFiles[0].contents;
    expect(model).toContain('@template');
    expect(model).toContain('import org.accordproject.contract@0.2.0.Contract');
    expect(model).not.toContain('company_name optional');
    expect(model).not.toContain('company_signatory_name optional');
    expect(template.templateModel.model.ctoFiles[1].contents).toContain(
      'namespace org.accordproject.contract@0.2.0',
    );
    expect(toApapTemplateRelationship(template)).toBe(
      `resource:org.accordproject.protocol@1.0.0.Template#${template.uri}`,
    );
  });

  it('derives model properties from metadata when the Concerto source drifts', () => {
    const source = readFileSync(MODEL_PATH, 'utf8');
    const drifted = source
      .replace(/^\s*o String company_name optional\n/m, '')
      .replace(/^\s*o Boolean personnel_nonsolicit_included [^\n]*\n/m, '')
      .replace(/^\}/m, '  o String retired_field optional\n}');
    expect(drifted).not.toBe(source);
    const driftedPath = modelFileWith(drifted);

    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: driftedPath,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const model = template.templateModel.model.ctoFiles[0].contents;
    const metadata = loadMetadata(TEMPLATE_DIR);
    const properties = [...model.matchAll(/^\s*o\s+\S+\s+(\w+)/gm)].map((match) => match[1]);
    expect(properties).toEqual(metadata.fields.map((field) => field.name));
    expect(model).toMatch(/^ {2}o String company_name$/m);
    expect(model).toMatch(/^ {2}o Boolean personnel_nonsolicit_included default=true$/m);
    expect(model).not.toContain('retired_field');
    expect(model).not.toMatch(/\boptional\b/);
    const excluded = metadata.fields.find((field) => field.name === 'excluded_inventions_statement');
    expect(model).toContain(`o String excluded_inventions_statement default=${JSON.stringify(excluded?.default)}`);
    expect(model).toMatch(/^namespace org\.openagreements\.custom\.employeeipinventionsassignment@1\.0\.0$/m);
    expect(model).toMatch(/^@template\nasset EmployeeIpInventionsAssignment extends Contract \{$/m);
  });

  it('exports and accepts data for a field added upstream without a Concerto edit', () => {
    const templateDir = templateWithExtraFields([
      { name: 'upstream_required_term', type: 'string', description: 'Added upstream with no default' },
      { name: 'upstream_clause_included', type: 'boolean', description: 'Added upstream', default: 'false' },
      { name: 'upstream_cure_days', type: 'number', description: 'Added upstream', default: '30' },
      { name: 'upstream_forum', type: 'enum', description: 'Added upstream', options: ['state court', 'arbitration'], default: 'state court' },
    ]);

    const template = exportTemplateToApap({
      templateDir,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const model = template.templateModel.model.ctoFiles[0].contents;
    expect(model).toMatch(/^ {2}o String upstream_required_term$/m);
    expect(model).toMatch(/^ {2}o Boolean upstream_clause_included default=false$/m);
    expect(model).toMatch(/^ {2}o Double upstream_cure_days default=30\.0$/m);
    expect(model).toMatch(/^ {2}o String upstream_forum default="state_court"$/m);

    const metadata = loadMetadata(templateDir);
    const data = toApapAgreementData(template, metadata, {
      contractId: 'upstream-field',
      values: withRequiredSampleValues(metadata.fields, VALUES),
    });
    expect(data.upstream_required_term).toBe('Example upstream required term');
    expect(data.upstream_clause_included).toBe(false);
    expect(data.upstream_cure_days).toBe(30);
    expect(data.upstream_forum).toBe('state_court');
  });

  it('maps list and fractional defaults, keeps one @template, and fails clearly on unsupported shapes', () => {
    const exportWith = (templateDir: string, concertoModelPath = MODEL_PATH) => exportTemplateToApap({
      templateDir, concertoModelPath, concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const listAndFraction = templateWithExtraFields([
      { name: 'upstream_tags', type: 'multiselect', description: 'Added upstream', options: ['alpha', 'beta'], default: '["alpha"]' },
      { name: 'upstream_rate', type: 'number', description: 'Added upstream', default: '2.5' },
    ]);
    const model = exportWith(listAndFraction).templateModel.model.ctoFiles[0].contents;
    expect(model).toMatch(/^ {2}o String\[\] upstream_tags$/m);
    expect(model).toMatch(/^ {2}o Double upstream_rate default=2\.5$/m);

    const source = readFileSync(MODEL_PATH, 'utf8');
    const decorated = source.replace(/^(asset )/m, '@template\n$1');
    const decoratedModel = exportWith(TEMPLATE_DIR, modelFileWith(decorated)).templateModel.model.ctoFiles[0].contents;
    expect(decoratedModel.match(/^@template$/gm)).toHaveLength(1);

    const rows = templateWithExtraFields([{
      name: 'upstream_rows', type: 'array', description: 'Added upstream',
      items: [{ name: 'label', type: 'string', description: 'Label' }],
    }]);
    expect(() => exportWith(rows)).toThrow('APAP export does not yet support array fields: upstream_rows');

    const inlineBlock = source.replace(/\{\n[\s\S]*?\n\}/, '{ o String company_name }');
    expect(() => exportWith(TEMPLATE_DIR, modelFileWith(inlineBlock)))
      .toThrow('Concerto model has no single-line Contract declaration block');
  });

  it('round-trips APAP Concerto data into a filled DOCX', async () => {
    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const metadata = loadMetadata(TEMPLATE_DIR);
    const agreementData = toApapAgreementData(template, metadata, {
      contractId: 'oa-ciiaa-001',
      values: withRequiredSampleValues(metadata.fields, VALUES),
    });
    expect(agreementData.$class).toBe(template.templateModel.typeName);
    expect(agreementData.contractId).toBe('oa-ciiaa-001');

    const outputPath = join(mkdtempSync(join(tmpdir(), 'oa-apap-ciiaa-')), 'ciiaa.docx');
    const result = await fillApapAgreementToDocx({ templateDir: TEMPLATE_DIR, agreementData, outputPath });
    expect(result.outputPath).toBe(outputPath);
    expect(readFileSync(outputPath).subarray(0, 2).toString()).toBe('PK');
    expect(result.providedFieldsUsed).toContain('company_name');
    const documentXml = new AdmZip(outputPath).readAsText('word/document.xml');
    expect(documentXml).toContain('Example Labs, Inc.');
    expect(documentXml).toContain('Taylor Jones');
    expect(documentXml).not.toContain('{company_name}');
    const footerXml = new AdmZip(outputPath).readAsText('word/footer1.xml');
    expect(footerXml).toContain('<w:sz w:val="16"/>');
    expect(footerXml).not.toContain('<w:sz w:val="18"/>');
  });

  it('fails closed on unsupported directives and incomplete legal data', () => {
    expect(() => canonicalMdocToApapTemplateMark('{% magic value="x" %}')).toThrow(
      'Unsupported canonical MDoc directive: magic',
    );
    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    expect(() => toApapAgreementData(template, loadMetadata(TEMPLATE_DIR), {
      contractId: 'incomplete',
      values: { company_name: 'Example Labs, Inc.' },
    })).toThrow('APAP agreement data is missing fields:');
  });

  it('preserves defaults and permits opting out of both post-employment clauses through APAP', async () => {
    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const metadata = loadMetadata(TEMPLATE_DIR);
    const values = withRequiredSampleValues(metadata.fields, VALUES);
    const defaultData = toApapAgreementData(template, metadata, {
      contractId: 'defaults', values,
    });
    expect(defaultData.personnel_nonsolicit_included).toBe(true);
    expect(defaultData.future_employer_notice_included).toBe(true);
    const agreementData = toApapAgreementData(template, metadata, {
      contractId: 'opt-out',
      values: { ...values, personnel_nonsolicit_included: false, future_employer_notice_included: false },
    });
    const outputPath = join(mkdtempSync(join(tmpdir(), 'oa-apap-opt-out-')), 'ciiaa.docx');
    await fillApapAgreementToDocx({ templateDir: TEMPLATE_DIR, agreementData, outputPath });
    const xml = new AdmZip(outputPath).readAsText('word/document.xml');
    expect(xml).not.toContain('No Solicitation of Company Personnel');
    expect(xml).not.toContain('Notice to Future Employers');
    expect(xml).toContain('Employee hereby assigns');
    expect(xml).toContain('Defend Trade Secrets Act');
  });
});

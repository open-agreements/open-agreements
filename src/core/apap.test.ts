import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect } from 'vitest';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { loadMetadata } from './metadata.js';
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

  it('round-trips APAP Concerto data into a filled DOCX', async () => {
    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });
    const agreementData = toApapAgreementData(template, loadMetadata(TEMPLATE_DIR), {
      contractId: 'oa-ciiaa-001',
      values: VALUES,
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
});

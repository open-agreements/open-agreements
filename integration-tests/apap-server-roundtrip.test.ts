import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { loadMetadata } from '../src/core/metadata.js';
import {
  exportTemplateToApap,
  fillApapAgreementToDocx,
  toApapAgreementData,
  toApapTemplateRelationship,
} from '../src/core/apap.js';

const APAP_BASE_URL = process.env.APAP_BASE_URL?.replace(/\/$/, '');
const ROOT = resolve(import.meta.dirname, '..');
const TEMPLATE_ID = 'openagreements-confidentiality-invention-assignment-agreement';
const TEMPLATE_DIR = join(ROOT, 'templates/openagreements-cc-by-4.0', TEMPLATE_ID);
const MODEL_PATH = join(ROOT, 'concerto/openagreements-employee-ip-inventions-assignment.cto');
const CONTRACT_MODEL_PATH = join(ROOT, 'concerto/deps/@models.accordproject.org.accordproject.contract.cto');
const temporaryPaths: string[] = [];
const createdResources: Array<{ kind: 'agreements' | 'templates'; id: number }> = [];
const it = itAllure.epic('Platform & Distribution');

async function requestJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${APAP_BASE_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const responseText = await response.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new Error(
      `APAP ${init?.method ?? 'GET'} ${path} returned non-JSON (${response.status}): ${responseText}`,
    );
  }
  if (!response.ok) {
    throw new Error(`APAP ${init?.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

afterEach(async () => {
  const cleanupFailures: string[] = [];
  for (const resource of createdResources.reverse()) {
    try {
      const response = await fetch(`${APAP_BASE_URL}/${resource.kind}/${resource.id}`, { method: 'DELETE' });
      if (!response.ok) cleanupFailures.push(`${resource.kind}/${resource.id}: HTTP ${response.status}`);
    } catch (error) {
      cleanupFailures.push(`${resource.kind}/${resource.id}: ${String(error)}`);
    }
  }
  createdResources.length = 0;
  for (const path of temporaryPaths) rmSync(path, { recursive: true, force: true });
  temporaryPaths.length = 0;
  if (cleanupFailures.length > 0) throw new Error(`APAP cleanup failed: ${cleanupFailures.join('; ')}`);
});

describe.skipIf(!APAP_BASE_URL)('APAP reference-server round trip', () => {
  it('registers the CIIAA template, creates an agreement, and renders returned data', async () => {
    const runId = randomUUID();
    const template = exportTemplateToApap({
      templateDir: TEMPLATE_DIR,
      concertoModelPath: MODEL_PATH,
      concertoDependencyPaths: [CONTRACT_MODEL_PATH],
    });

    const registeredTemplate = await requestJson('/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
    createdResources.push({ kind: 'templates', id: Number(registeredTemplate.id) });

    const agreementData = toApapAgreementData(template, loadMetadata(TEMPLATE_DIR), {
      contractId: `oa-ciiaa-${runId}`,
      values: {
        company_name: 'Example Labs, Inc.',
        company_signatory_name: 'Alex Smith',
        company_signatory_title: 'President',
        employee_name: 'Taylor Jones',
        effective_date: '2026-09-04',
        prior_inventions_disclosure: 'None',
        excluded_inventions_statement: 'Personal projects listed on Schedule A are excluded.',
        return_of_materials_timing: 'within five business days after termination',
        post_termination_assistance: 'reasonable assistance on reasonable notice',
        governing_law: 'New York',
        venue: 'state and federal courts located in New York County, New York',
      },
    });
    const createdAgreement = await requestJson('/agreements', {
      method: 'POST',
      body: JSON.stringify({
        $class: 'org.accordproject.protocol@1.0.0.Agreement',
        uri: `https://openagreements.org/apap-tests/agreements/${runId}`,
        data: agreementData,
        template: toApapTemplateRelationship(template),
        agreementStatus: 'DRAFT',
      }),
    });
    createdResources.push({ kind: 'agreements', id: Number(createdAgreement.id) });

    expect(createdAgreement.template).toBe(toApapTemplateRelationship(template));
    expect(createdAgreement.data).toEqual(agreementData);

    const outputDir = mkdtempSync(join(tmpdir(), 'oa-apap-server-'));
    temporaryPaths.push(outputDir);
    const outputPath = join(outputDir, 'ciiaa.docx');
    await fillApapAgreementToDocx({
      templateDir: TEMPLATE_DIR,
      agreementData: createdAgreement.data as Record<string, unknown>,
      outputPath,
    });

    expect(readFileSync(outputPath).subarray(0, 2).toString()).toBe('PK');
    const documentXml = new AdmZip(outputPath).readAsText('word/document.xml');
    expect(documentXml).toContain('Example Labs, Inc.');
    expect(documentXml).toContain('Taylor Jones');
    expect(documentXml).not.toContain('{company_name}');
  }, 30_000);
});

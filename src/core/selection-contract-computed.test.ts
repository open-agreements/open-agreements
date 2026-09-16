import { afterEach, describe, expect, it } from 'vitest';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { getParagraphText } from '@usejunior/docx-core';
import { compileSelectionContract, fillSelectionContract, type SelectionContract } from './selection-contract.js';
import { BLANK_PLACEHOLDER } from './fill-utils.js';

const bontermsDir = resolve('templates/bonterms-cc0-1.0/bonterms-mutual-nda');
const csaDir = resolve('templates/common-paper-cc-by-4.0/common-paper-cloud-service-agreement');
const derivedTargets = new Set([
  'party_1_signatory_name_and_title', 'party_2_signatory_name_and_title',
  'party_1_notice_email_check', 'party_1_notice_postal_check',
  'party_2_notice_email_check', 'party_2_notice_postal_check',
  'order_date_display', 'pilot_fee_display', 'fees_display', 'payment_display',
  'auto_renewal_display', 'effective_date_display', 'covered_claims_display', 'general_cap_display',
]);
const temporaryPaths: string[] = [];

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

function temporaryDirectory(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  temporaryPaths.push(path);
  return path;
}

function representativeValues(contract: SelectionContract): Record<string, string | boolean> {
  return Object.fromEntries(contract.metadata.fields
    .filter((field) => !derivedTargets.has(field.name))
    .map((field) => [field.name,
      field.default !== undefined
        ? field.type === 'boolean' ? field.default === 'true' : field.default
        : field.type === 'boolean' ? false
          : field.type === 'date' ? '2026-09-16'
            : field.type === 'enum' ? field.options![0] : `VALUE_${field.name}`,
    ]));
}

function outputPath(name: string): string {
  return join(temporaryDirectory('oa-computed-output-'), `${name}.docx`);
}

function bodyParagraphs(path: string): string[] {
  const entry = new AdmZip(readFileSync(path)).getEntry('word/document.xml');
  if (!entry) throw new Error('Filled output is missing word/document.xml');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf8'), 'application/xml');
  return Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'))
    .map((paragraph) => getParagraphText(paragraph as unknown as Parameters<typeof getParagraphText>[0])
      .replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function fill(
  templateDir: string,
  contract: SelectionContract,
  name: string,
  overrides: Record<string, string | boolean>,
): Promise<string[]> {
  const path = outputPath(name);
  await fillSelectionContract(templateDir, contract, { ...representativeValues(contract), ...overrides }, path);
  return bodyParagraphs(path);
}

function expectParagraph(paragraphs: string[], exact: string): void {
  expect(paragraphs.filter((paragraph) => paragraph === exact), exact).toHaveLength(1);
}

function expectSegment(paragraphs: string[], segment: string): void {
  expect(paragraphs.filter((paragraph) => paragraph.includes(segment)), segment).toHaveLength(1);
}

describe('computed display rules compile from actual third-party templates', () => {
  it.each([
    ['entity', 'individual'],
    ['individual', 'entity'],
  ] as const)('Bonterms derives both parties for %s/%s signatories', async (party1Type, party2Type) => {
    const contract = await compileSelectionContract(bontermsDir);
    const paragraphs = await fill(bontermsDir, contract, `bonterms-${party1Type}-${party2Type}`, {
      party_1_signatory_type: party1Type,
      party_2_signatory_type: party2Type,
      party_1_name: 'Fallback Company One',
      party_2_name: 'Fallback Company Two',
      party_1_signatory_company: BLANK_PLACEHOLDER,
      party_2_signatory_company: '',
      party_1_signatory_name: 'Ada One',
      party_1_signatory_title: 'General Counsel',
      party_2_signatory_name: 'Bob Two',
      party_2_signatory_title: '',
      party_1_email: 'ada@example.test',
      party_1_address: '',
      party_2_email: BLANK_PLACEHOLDER,
      party_2_address: '2 Main Street',
    });

    expectParagraph(paragraphs, 'Name and Title: Ada One, General Counsel');
    expectParagraph(paragraphs, 'Name and Title: Bob Two');
    expectParagraph(paragraphs, 'Company: Fallback Company One');
    expectParagraph(paragraphs, 'Company: Fallback Company Two');
    expectParagraph(paragraphs, '☑ Email: ada@example.test');
    expectParagraph(paragraphs, '☐ Postal mail:');
    expectParagraph(paragraphs, '☐ Email:');
    expectParagraph(paragraphs, '☑ Postal mail: 2 Main Street');
    expect(paragraphs.join('\n')).not.toContain(BLANK_PLACEHOLDER);
  });

  it('Bonterms handles title-only and fully blank signatory displays without underscore leakage', async () => {
    const contract = await compileSelectionContract(bontermsDir);
    const paragraphs = await fill(bontermsDir, contract, 'bonterms-blank', {
      party_1_signatory_name: '', party_1_signatory_title: 'Treasurer',
      party_2_signatory_name: BLANK_PLACEHOLDER, party_2_signatory_title: BLANK_PLACEHOLDER,
      party_1_email: '', party_1_address: BLANK_PLACEHOLDER,
      party_2_email: '', party_2_address: '',
    });
    expectParagraph(paragraphs, 'Name and Title: Treasurer');
    expectParagraph(paragraphs, 'Name and Title:');
    expect(paragraphs.join('\n')).not.toContain(BLANK_PLACEHOLDER);
  });

  it('CSA renders every affirmative display line and multiplier-cap priority exactly', async () => {
    const contract = await compileSelectionContract(csaDir);
    const paragraphs = await fill(csaDir, contract, 'csa-affirmative', {
      order_date_is_last_signature: true,
      has_pilot: true, pilot_is_free: true,
      fee_is_per_unit: true, fees: '$10', fee_unit: 'seat/month',
      fee_is_other: true, other_fee_structure: 'Custom fee',
      fee_may_increase: true, fee_increase_cap_pct: '5',
      fee_will_increase: true, fee_increase_fixed_pct: '3',
      fee_inclusive_of_taxes: true,
      payment_by_invoice: true, payment_frequency: 'monthly', payment_terms_days: '30', payment_due_from: 'invoice date',
      auto_renew: true, non_renewal_notice_days: '60',
      effective_date_is_last_signature: true,
      has_covered_claims: true, has_provider_covered_claims: true, has_customer_covered_claims: true,
      general_cap_is_multiplier: true, general_cap_multiplier: '2',
      general_cap_is_dollar: true, general_cap_dollar: '50000',
      general_cap_is_greater_of: true, general_cap_greater_dollar: '25000', general_cap_greater_multiplier: '3',
    });

    for (const exact of [
      '( x ) Date of last signature on this Order Form',
      '( x ) Free trial',
      '( x ) Pay by invoice Provider will invoice Customer monthly. Customer will pay each invoice within 30 days of invoice date.',
      '( x ) Non-Renewal Notice Date is 60 days before the end of the current Subscription Period.',
      '( x ) Date of last Cover Page signature',
      '( x ) 2x the Fees paid or payable by Customer in the 12 month period immediately preceding the claim',
    ]) expectParagraph(paragraphs, exact);
    // These legacy display values contain line-feed-separated items inside one
    // DOCX paragraph. Prove every independently selected semantic item once;
    // do not require a new Word paragraph that the source template never had.
    for (const segment of [
      '[ x ] $10 per seat/month',
      '[ x ] Other fee structure: Custom fee',
      '[ x ] Fees may increase up to 5% per renewal',
      '[ x ] Fees will increase 3% per renewal',
      '[ x ] Fees are inclusive of taxes (modifies Standard Terms Section 4.1)',
      '[ x ] Provider Covered Claims: [Any action, proceeding, or claim that the Cloud Service, when used by Customer as permitted under the Agreement, infringes or misappropriates a third party’s intellectual property rights.]',
      '[ x ] Customer Covered Claims: [Any action, proceeding, or claim that (1) the Customer Content, when used according to the Agreement, infringes or misappropriates a third party’s intellectual property rights; or (2) results from the Customer’s breach of Section 2.4.]',
    ]) expectSegment(paragraphs, segment);
    expect(paragraphs.join('\n')).not.toContain('( x ) $50000');
    expect(paragraphs.join('\n')).not.toContain('The greater of $25000');
  });

  it.each([
    ['dollar', { general_cap_is_multiplier: false, general_cap_is_dollar: true, general_cap_is_greater_of: false }, '( x ) $50000'],
    ['greater-of', { general_cap_is_multiplier: false, general_cap_is_dollar: false, general_cap_is_greater_of: true }, '( x ) The greater of $25000 or 3x the Fees paid or payable by Customer in the 12 month period immediately preceding the claim'],
  ] as const)('CSA renders custom/automatic alternatives and the %s cap', async (_variant, capValues, expectedCap) => {
    const contract = await compileSelectionContract(csaDir);
    const paragraphs = await fill(csaDir, contract, `csa-${_variant}`, {
      order_date_is_last_signature: false, custom_order_date: 'March 1, 2026',
      has_pilot: true, pilot_is_free: false, pilot_fee: '$1000',
      fee_is_per_unit: false, fee_is_other: false, fee_may_increase: false,
      fee_will_increase: false, fee_inclusive_of_taxes: false,
      payment_by_invoice: false, payment_frequency: 'quarterly',
      auto_renew: false,
      effective_date_is_last_signature: false, custom_effective_date: 'March 5, 2026',
      has_covered_claims: true, has_provider_covered_claims: false, has_customer_covered_claims: false,
      general_cap_dollar: '50000', general_cap_greater_dollar: '25000', general_cap_greater_multiplier: '3',
      ...capValues,
    });

    for (const exact of [
      '( x ) March 1, 2026',
      '( x ) Fee for Pilot Period: $1000',
      '( x ) Automatic payment Customer authorizes Provider to charge the payment method on file quarterly.',
      '( x ) This Order does not automatically renew.',
      '( x ) March 5, 2026',
      expectedCap,
    ]) expectParagraph(paragraphs, exact);
    expect(paragraphs.some((paragraph) => paragraph.startsWith('[ x ] Provider Covered Claims:'))).toBe(false);
    expect(paragraphs.some((paragraph) => paragraph.startsWith('[ x ] Customer Covered Claims:'))).toBe(false);
    expect(paragraphs.some((paragraph) => /^\[ x \] (?:\$|Other fee|Fees )/.test(paragraph))).toBe(false);
  });

  it('rejects caller ownership of derived targets, including blank and preset values', async () => {
    for (const [dir, target, value] of [
      [bontermsDir, 'party_1_signatory_name_and_title', 'Preset signer'],
      [bontermsDir, 'party_1_notice_email_check', ''],
      [csaDir, 'payment_display', 'PRESET PAYMENT DISPLAY'],
      [csaDir, 'general_cap_display', ''],
    ] as const) {
      const contract = await compileSelectionContract(dir);
      await expect(fillSelectionContract(dir, contract, { ...representativeValues(contract), [target]: value }, outputPath(`readonly-${target}`)))
        .rejects.toThrow(/computed|derived|read.?only|invalid input/i);
    }
  });

  it('rejects contract-rule tampering and source-manifest drift before filling', async () => {
    const contract = await compileSelectionContract(csaDir);
    const tampered = structuredClone(contract) as SelectionContract;
    expect(tampered.rules.length).toBeGreaterThan(0);
    tampered.rules.reverse();
    await expect(fillSelectionContract(csaDir, tampered, representativeValues(contract), outputPath('tampered-contract')))
      .rejects.toThrow(/contract\/source mismatch|regenerate and verify/i);

    const copied = temporaryDirectory('oa-computed-source-');
    cpSync(bontermsDir, copied, { recursive: true });
    const copiedContract = await compileSelectionContract(copied);
    appendFileSync(join(copied, 'metadata.yaml'), '\n# synthetic source drift\n');
    await expect(fillSelectionContract(copied, copiedContract, representativeValues(copiedContract), outputPath('tampered-source')))
      .rejects.toThrow(/contract\/source mismatch|regenerate and verify/i);
  });
});

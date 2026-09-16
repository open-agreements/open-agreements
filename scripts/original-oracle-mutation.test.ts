import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';
import { compileOriginalContract, fillOriginalContract } from '../src/core/original-contract.js';
import { generateVerificationCases, verifyOriginalSemanticOracle } from './verify-original-contracts.js';

const ROSTER = 'templates/openagreements-cc0-1.0/openagreements-working-group-list';
const FLORIDA = 'templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-florida';
const BOARD = 'templates/openagreements-cc-by-4.0/openagreements-board-consent-safe';
const temporary: string[] = [];

const output = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), 'oa-oracle-mutation-'));
  temporary.push(directory);
  return join(directory, `${name}.docx`);
};

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const decode = (value: string): string => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const paragraphText = (xml: string): string => decode(
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join(''),
);

const mutateParagraph = (
  path: string,
  matchText: string,
  mutation: 'drop' | 'duplicate' | ((paragraph: string) => string),
): string => {
  const zip = new AdmZip(path);
  const document = zip.readAsText('word/document.xml');
  const paragraphs = [...document.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
  const target = paragraphs.find((candidate) => paragraphText(candidate[0]).includes(matchText));
  if (!target || target.index === undefined) throw new Error(`Mutation target not found: ${matchText}`);
  const replacement = mutation === 'drop' ? '' : mutation === 'duplicate' ? target[0] + target[0] : mutation(target[0]);
  const changed = document.slice(0, target.index) + replacement + document.slice(target.index + target[0].length);
  zip.updateFile('word/document.xml', Buffer.from(changed));
  zip.writeZip(path);
  return path;
};

const transplantParagraph = (sourcePath: string, targetPath: string, matchText: string): string => {
  const source = new AdmZip(sourcePath).readAsText('word/document.xml');
  const paragraph = [...source.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)]
    .find((candidate) => paragraphText(candidate[0]).includes(matchText))?.[0];
  if (!paragraph) throw new Error(`Transplant source not found: ${matchText}`);
  const zip = new AdmZip(targetPath);
  const target = zip.readAsText('word/document.xml');
  zip.updateFile('word/document.xml', Buffer.from(target.replace('</w:body>', `${paragraph}</w:body>`)));
  zip.writeZip(targetPath);
  return targetPath;
};

const rosterValues = (rows: Array<Record<string, string>>) => ({
  deal_name: 'Oracle Deal', updated_at: 'September 15, 2026', working_group: rows,
});

const row = (ordinal: number) => ({
  name: `OA_VERIFY_NAME_ROW_${ordinal}`,
  organization: `OA_VERIFY_ORG_ROW_${ordinal}`,
  role: `OA_VERIFY_ROLE_ROW_${ordinal}`,
  email: `verify-row-${ordinal}@example.test`,
});

describe('original semantic oracle mutation resistance', () => {
  it('checks typed dates in repeated signer scope independently of the effective date', async () => {
    const contract = await compileOriginalContract(BOARD);
    const values = { company_name: 'Synthetic Company', purchase_amount: '1000', effective_date: '2026-09-30',
      board_members: [{ name: 'First Director', signing_date: '2026-09-16' }, { name: 'Second Director', signing_date: '2026-09-18' }] };
    const path = output('signer-dates');
    await fillOriginalContract(BOARD, contract, values, path);
    expect(verifyOriginalSemanticOracle(BOARD, contract, values, path)).toEqual([]);
    mutateParagraph(path, 'September 18, 2026', paragraph => paragraph.replace('September 18, 2026', 'September 30, 2026'));
    expect(verifyOriginalSemanticOracle(BOARD, contract, values, path)).toEqual(expect.arrayContaining([
      expect.stringContaining('ordered body oracle mismatch'),
    ]));
  });

  it('rejects missing attribution and altered running headers independently of body correctness', async () => {
    const contract = await compileOriginalContract(ROSTER);
    const values = rosterValues([]);
    const path = output('running-parts');
    await fillOriginalContract(ROSTER, contract, values, path);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, path)).toEqual([]);
    const zip = new AdmZip(path);
    const footer = zip.getEntries().find(entry => /^word\/footer\d+\.xml$/.test(entry.entryName));
    if (!footer) throw new Error('Expected source-derived footer');
    zip.deleteFile(footer.entryName);
    zip.writeZip(path);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, path)).toEqual(expect.arrayContaining([
      expect.stringContaining('source footer expected one package part'),
    ]));

    const headerPath = output('altered-header');
    await fillOriginalContract(ROSTER, contract, values, headerPath);
    const altered = new AdmZip(headerPath);
    const header = altered.getEntries().find(entry => /^word\/header\d+\.xml$/.test(entry.entryName));
    if (!header) throw new Error('Expected source-derived header');
    altered.updateFile(header.entryName, Buffer.from(header.getData().toString('utf8').replace(/<w:t([^>]*)>[^<]*<\/w:t>/, '<w:t$1>Wrong source title</w:t>')));
    altered.writeZip(headerPath);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, headerPath)).toEqual(expect.arrayContaining([
      expect.stringContaining('source header text/attribution was not preserved'),
    ]));
  });

  it('rejects publisher identity in the running header and missing page fields', async () => {
    const contract = await compileOriginalContract(ROSTER);
    const values = rosterValues([]);
    const path = output('publisher-header');
    await fillOriginalContract(ROSTER, contract, values, path);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, path)).toEqual([]);
    const zip = new AdmZip(path);
    const header = zip.getEntries().find(entry => /^word\/header\d+\.xml$/.test(entry.entryName));
    if (!header) throw new Error('Expected neutral title header');
    zip.updateFile(header.entryName, Buffer.from(header.getData().toString('utf8').replace(/<w:t([^>]*)>[^<]*<\/w:t>/, '<w:t$1>OpenAgreements publisher policy</w:t>')));
    zip.writeZip(path);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, path)).toEqual(expect.arrayContaining([
      expect.stringContaining('source header text/attribution was not preserved'),
    ]));
    const pagePath = output('missing-page-field');
    await fillOriginalContract(ROSTER, contract, values, pagePath);
    const paged = new AdmZip(pagePath);
    const footer = paged.getEntries().find(entry => /^word\/footer\d+\.xml$/.test(entry.entryName));
    if (!footer) throw new Error('Expected paged footer');
    const before = footer.getData().toString('utf8');
    const after = before.replace(/NUMPAGES/g, 'UNSUPPORTED_PAGE_FIELD');
    expect(after).not.toBe(before);
    paged.updateFile(footer.entryName, Buffer.from(after));
    paged.writeZip(pagePath);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, pagePath)).toEqual(expect.arrayContaining([
      expect.stringContaining('source footer requires one PAGE and one NUMPAGES field'),
    ]));
  });

  it('rejects dropped and duplicated unconditional source prose', async () => {
    const contract = await compileOriginalContract(ROSTER);
    const values = rosterValues([]);
    const dropped = output('dropped-prose');
    await fillOriginalContract(ROSTER, contract, values, dropped);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, dropped)).toEqual([]);
    mutateParagraph(dropped, 'This roster is a working tool', 'drop');
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, dropped)).not.toEqual([]);

    const duplicated = output('duplicated-prose');
    await fillOriginalContract(ROSTER, contract, values, duplicated);
    mutateParagraph(duplicated, 'This roster is a working tool', 'duplicate');
    expect(verifyOriginalSemanticOracle(ROSTER, contract, values, duplicated)).not.toEqual([]);
  });

  it('rejects phantom zero rows, damaged one-row prose, and duplicated two-row output', async () => {
    const contract = await compileOriginalContract(ROSTER);
    const oneValues = rosterValues([row(1)]);
    const one = output('one-row-source');
    await fillOriginalContract(ROSTER, contract, oneValues, one);
    expect(verifyOriginalSemanticOracle(ROSTER, contract, oneValues, one)).toEqual([]);

    const zeroValues = rosterValues([]);
    const zero = output('zero-row-phantom');
    await fillOriginalContract(ROSTER, contract, zeroValues, zero);
    transplantParagraph(one, zero, 'OA_VERIFY_NAME_ROW_1');
    expect(verifyOriginalSemanticOracle(ROSTER, contract, zeroValues, zero)).not.toEqual([]);

    mutateParagraph(one, 'OA_VERIFY_NAME_ROW_1', (paragraph) => {
      const changed = paragraph.replace(' — ', '');
      if (changed === paragraph) throw new Error('Static repeat prose mutation did not change the paragraph');
      return changed;
    });
    expect(verifyOriginalSemanticOracle(ROSTER, contract, oneValues, one)).not.toEqual([]);

    const twoValues = rosterValues([row(1), row(2)]);
    const two = output('two-row-duplicate');
    await fillOriginalContract(ROSTER, contract, twoValues, two);
    mutateParagraph(two, 'OA_VERIFY_NAME_ROW_2', 'duplicate');
    expect(verifyOriginalSemanticOracle(ROSTER, contract, twoValues, two)).not.toEqual([]);
  });

  it('proves the confirmation triad and rejects warning/body cardinality mutations', async () => {
    const contract = await compileOriginalContract(FLORIDA);
    const cases = [
      { name: 'inapplicable', covered: false, confirmed: false },
      { name: 'pending', covered: true, confirmed: false },
      { name: 'confirmed', covered: true, confirmed: true },
    ];
    const publicBaseline = generateVerificationCases(contract.metadata)[0].values;
    const rendered = new Map<string, { path: string; values: Record<string, unknown> }>();
    for (const state of cases) {
      const values = {
        ...publicBaseline,
        employer_name: 'Oracle Employer', employee_name: 'Oracle Employee',
        covered_employee: state.covered, choice_act_advance_notice_confirmed: state.confirmed,
      };
      const path = output(`confirm-${state.name}`);
      await fillOriginalContract(FLORIDA, contract, values, path);
      expect(verifyOriginalSemanticOracle(FLORIDA, contract, values, path), state.name).toEqual([]);
      rendered.set(state.name, { path, values });
    }

    const pending = rendered.get('pending')!;
    mutateParagraph(pending.path, 'CONFIRM before signing:', 'duplicate');
    expect(verifyOriginalSemanticOracle(FLORIDA, contract, pending.values, pending.path)).not.toEqual([]);

    const confirmed = rendered.get('confirmed')!;
    transplantParagraph(rendered.get('pending')!.path, confirmed.path, 'CONFIRM BEFORE SIGNING:');
    expect(verifyOriginalSemanticOracle(FLORIDA, contract, confirmed.values, confirmed.path)).not.toEqual([]);

    const inapplicable = rendered.get('inapplicable')!;
    transplantParagraph(rendered.get('confirmed')!.path, inapplicable.path, 'CHOICE Act Counsel Advisal');
    expect(verifyOriginalSemanticOracle(FLORIDA, contract, inapplicable.values, inapplicable.path)).not.toEqual([]);
  }, 30_000);
});

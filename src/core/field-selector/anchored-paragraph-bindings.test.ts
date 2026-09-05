import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import AdmZip from 'adm-zip';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  bindAnchoredParagraphFields,
  type AnchoredParagraphBindingsConfig,
} from './anchored-paragraph-bindings.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Filling & Rendering');

function p(inner: string): string { return `<w:p>${inner}</w:p>`; }
function text(value: string): string { return `<w:r><w:t xml:space="preserve">${value}</w:t></w:r>`; }
function label(value: string): string {
  return `<w:r><w:t xml:space="preserve">${value}</w:t><w:tab/></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:tab/></w:r>`;
}

function build(body: string): { dir: string; input: string; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'anchored-bindings-'));
  const input = join(dir, 'input.docx');
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(
    `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`,
  ));
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.writeZip(input);
  return { dir, input, output: join(dir, 'output.docx') };
}

const config: AnchoredParagraphBindingsConfig = {
  groups: [
    {
      id: 'company',
      start_anchor: 'COMPANY: [Insert Company Name]',
      end_anchor: 'INVESTORS: [Insert Investor Name]',
      expected_group_matches: 1,
      bindings: [
        { label: 'Name:', field: 'company_signatory_name', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true },
        { label: 'Title:', field: 'company_signatory_title', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true },
        { label: 'Address:', field: 'company_notice_address', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true },
        { label: 'Email:', field: 'company_notice_email', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true },
      ],
    },
    {
      id: 'investor',
      start_anchor: 'INVESTORS: [Insert Investor Name]',
      end_anchor: 'KEY HOLDERS:',
      expected_group_matches: 1,
      bindings: [
        { label: 'Name:', field: 'investor_signatory_name', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true },
        { label: 'Title:', field: 'investor_signatory_title', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true },
      ],
    },
  ],
};

const signatureBody =
  p(text('OUTSIDE') + label('Name:')) +
  p(text('COMPANY:') + '<w:r><w:tab/></w:r>' + text('[Insert Company Name]')) +
  p(label('By:')) + p(label('Name:')) +
  p(label('Title:') + '<w:r><w:br/><w:t xml:space="preserve">Address: </w:t><w:tab/><w:br/><w:tab/></w:r>') +
  p(label('Email:')) +
  p(text('INVESTORS:') + '<w:r><w:tab/></w:r>' + text('[Insert Investor Name]')) +
  p(label('By:')) + p(label('Name:')) + p(label('Title:')) +
  p(text('KEY HOLDERS:'));

describe('anchor-scoped paragraph field binding', () => {
  it('binds repeated labels to distinct fields inside their unique boundaries', () => {
    const fixture = build(signatureBody);
    const before = new AdmZip(fixture.input).getEntry('word/document.xml')!.getData().toString('utf-8');
    bindAnchoredParagraphFields(fixture.input, fixture.output, config);
    const xml = new AdmZip(fixture.output).getEntry('word/document.xml')!.getData().toString('utf-8');

    for (const field of [
      'company_signatory_name', 'company_signatory_title', 'company_notice_address',
      'company_notice_email', 'investor_signatory_name', 'investor_signatory_title',
    ]) expect(xml).toContain(` {${field}}`);
    expect(xml).toContain('Name:</w:t><w:t xml:space="preserve"> {company_signatory_name}</w:t>');
    expect(xml).not.toContain('{outside');
    expect(xml).not.toContain('{By');
    expect((xml.match(/<w:tab/g) ?? []).length).toBe((before.match(/<w:tab/g) ?? []).length);
    expect((xml.match(/<w:br/g) ?? []).length).toBe((before.match(/<w:br/g) ?? []).length);
    expect((xml.match(/<w:u /g) ?? []).length).toBe((before.match(/<w:u /g) ?? []).length);
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  it('fails closed on a zero-match label without writing an output', () => {
    const fixture = build(signatureBody.replace('Email:', 'E-mail:'));
    expect(() => bindAnchoredParagraphFields(fixture.input, fixture.output, config))
      .toThrow(/company.*Email:.*found 0/);
    expect(existsSync(fixture.output)).toBe(false);
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  it('fails closed when a bounded label is ambiguous', () => {
    const fixture = build(signatureBody.replace(p(label('Email:')), p(label('Name:')) + p(label('Email:'))));
    expect(() => bindAnchoredParagraphFields(fixture.input, fixture.output, config))
      .toThrow(/company.*Name:.*found 2/);
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  it('fails closed on duplicate or reversed boundary anchors', () => {
    const duplicate = build(signatureBody + p(text('KEY HOLDERS:')));
    expect(() => bindAnchoredParagraphFields(duplicate.input, duplicate.output, config))
      .toThrow(/investor.*start=1, end=2/);
    rmSync(duplicate.dir, { recursive: true, force: true });

    const reversed = build(p(text('KEY HOLDERS:')) + signatureBody.replace(p(text('KEY HOLDERS:')), ''));
    expect(() => bindAnchoredParagraphFields(reversed.input, reversed.output, config))
      .toThrow(/end anchor does not follow start anchor/);
    rmSync(reversed.dir, { recursive: true, force: true });
  });

  it('matches Word smart apostrophes, quotes, and en/em dashes to straight config punctuation', () => {
    const fixture = build(
      p(text('COMPANY’S “SIGNATURE” — START')) +
      p(label('Officer’s “Name” –')) +
      p(text('INVESTOR’S “SIGNATURE” — END')),
    );
    const smartConfig: AnchoredParagraphBindingsConfig = {
      groups: [{
        id: 'smart-punctuation',
        start_anchor: 'COMPANY\'S "SIGNATURE" - START',
        end_anchor: 'INVESTOR\'S "SIGNATURE" - END',
        expected_group_matches: 1,
        bindings: [{
          label: 'Officer\'s "Name" -',
          field: 'officer_name',
          expected_matches: 1,
          insert_after_label: true,
          preserve_following_tabs: true,
        }],
      }],
    };

    bindAnchoredParagraphFields(fixture.input, fixture.output, smartConfig);
    const xml = new AdmZip(fixture.output).getEntry('word/document.xml')!.getData().toString('utf-8');
    expect(xml).toContain('{officer_name}');
    expect(xml).toContain('COMPANY’S “SIGNATURE” — START');
    rmSync(fixture.dir, { recursive: true, force: true });
  });

  it('does not case-fold or erase non-equivalent punctuation', () => {
    const fixture = build(
      p(text('Company’s Signature — Start')) +
      p(label('Name;')) +
      p(text('End')),
    );
    const strictConfig: AnchoredParagraphBindingsConfig = {
      groups: [{
        id: 'still-exact',
        start_anchor: "COMPANY'S SIGNATURE - START",
        end_anchor: 'End',
        expected_group_matches: 1,
        bindings: [{
          label: 'Name:',
          field: 'name',
          expected_matches: 1,
          insert_after_label: true,
          preserve_following_tabs: true,
        }],
      }],
    };

    expect(() => bindAnchoredParagraphFields(fixture.input, fixture.output, strictConfig))
      .toThrow(/still-exact.*start=0/);
    expect(existsSync(fixture.output)).toBe(false);
    rmSync(fixture.dir, { recursive: true, force: true });
  });
});

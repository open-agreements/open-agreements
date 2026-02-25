import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import AdmZip from 'adm-zip';
import { enumerateTextParts, getGeneralTextPartNames } from './ooxml-parts.js';

const it = itAllure.epic('Discovery & Metadata');

describe('enumerateTextParts', () => {
  it.openspec('OA-ENG-007')('finds document.xml only in minimal zip', () => {
    const zip = new AdmZip();
    zip.addFile('word/document.xml', Buffer.from('<doc/>', 'utf-8'));
    zip.addFile('[Content_Types].xml', Buffer.from('<Types/>', 'utf-8'));

    const parts = enumerateTextParts(zip);
    expect(parts.document).toBe('word/document.xml');
    expect(parts.headers).toEqual([]);
    expect(parts.footers).toEqual([]);
    expect(parts.endnotes).toBeNull();
    expect(parts.footnotes).toBeNull();
  });

  it.openspec('OA-ENG-007')('finds all part types in a full zip', () => {
    const zip = new AdmZip();
    zip.addFile('word/document.xml', Buffer.from('<doc/>', 'utf-8'));
    zip.addFile('word/header1.xml', Buffer.from('<hdr/>', 'utf-8'));
    zip.addFile('word/header2.xml', Buffer.from('<hdr/>', 'utf-8'));
    zip.addFile('word/footer1.xml', Buffer.from('<ftr/>', 'utf-8'));
    zip.addFile('word/endnotes.xml', Buffer.from('<en/>', 'utf-8'));
    zip.addFile('word/footnotes.xml', Buffer.from('<fn/>', 'utf-8'));
    zip.addFile('[Content_Types].xml', Buffer.from('<Types/>', 'utf-8'));

    const parts = enumerateTextParts(zip);
    expect(parts.document).toBe('word/document.xml');
    expect(parts.headers).toEqual(['word/header1.xml', 'word/header2.xml']);
    expect(parts.footers).toEqual(['word/footer1.xml']);
    expect(parts.endnotes).toBe('word/endnotes.xml');
    expect(parts.footnotes).toBe('word/footnotes.xml');
  });

  it.openspec('OA-ENG-007')('ignores non-matching files in word/', () => {
    const zip = new AdmZip();
    zip.addFile('word/document.xml', Buffer.from('<doc/>', 'utf-8'));
    zip.addFile('word/styles.xml', Buffer.from('<s/>', 'utf-8'));
    zip.addFile('word/settings.xml', Buffer.from('<s/>', 'utf-8'));
    zip.addFile('word/theme/theme1.xml', Buffer.from('<t/>', 'utf-8'));

    const parts = enumerateTextParts(zip);
    expect(parts.document).toBe('word/document.xml');
    expect(parts.headers).toEqual([]);
    expect(parts.footers).toEqual([]);
  });
});

describe('getGeneralTextPartNames', () => {
  it.openspec('OA-ENG-007')('returns flat list excluding footnotes', () => {
    const zip = new AdmZip();
    zip.addFile('word/document.xml', Buffer.from('<doc/>', 'utf-8'));
    zip.addFile('word/header1.xml', Buffer.from('<hdr/>', 'utf-8'));
    zip.addFile('word/footer1.xml', Buffer.from('<ftr/>', 'utf-8'));
    zip.addFile('word/endnotes.xml', Buffer.from('<en/>', 'utf-8'));
    zip.addFile('word/footnotes.xml', Buffer.from('<fn/>', 'utf-8'));

    const parts = enumerateTextParts(zip);
    const names = getGeneralTextPartNames(parts);

    expect(names).toContain('word/document.xml');
    expect(names).toContain('word/header1.xml');
    expect(names).toContain('word/footer1.xml');
    expect(names).toContain('word/endnotes.xml');
    expect(names).not.toContain('word/footnotes.xml');
  });

  it.openspec('OA-ENG-007')('returns empty array when no parts exist', () => {
    const zip = new AdmZip();
    zip.addFile('word/styles.xml', Buffer.from('<s/>', 'utf-8'));

    const parts = enumerateTextParts(zip);
    const names = getGeneralTextPartNames(parts);
    expect(names).toEqual([]);
  });
});

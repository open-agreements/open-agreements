import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';

import { lintDocx } from '../check_docx_structure.mjs';
import { postProcessGeneratedDocx, testInternals } from './docx-post-process.mjs';

const tempDirs = [];

function documentXml(body) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    body,
    '</w:body>',
    '</w:document>',
  ].join('');
}

function commentsXml(body) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    body,
    '</w:comments>',
  ].join('');
}

async function makeDocx(parts = {}) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    [
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
      '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>',
      '</Types>',
    ].join(''),
  );
  zip.file(
    'word/_rels/document.xml.rels',
    [
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>',
      '</Relationships>',
    ].join(''),
  );
  zip.file('word/document.xml', documentXml('<w:p><w:r><w:t>OK</w:t></w:r></w:p>'));
  zip.file('word/footer1.xml', parts.footer ?? '');
  if (parts.comments !== undefined) {
    zip.file('word/comments.xml', parts.comments);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

function writeTempDocx(buffer) {
  const dir = mkdtempSync(join(tmpdir(), 'oa-docx-post-process-'));
  tempDirs.push(dir);
  const path = join(dir, 'fixture.docx');
  writeFileSync(path, buffer);
  return path;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('docx post processing', () => {
  it('adds a cached result between field separate and end markers in one run', () => {
    const xml = [
      '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:p><w:r><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r></w:p>',
      '</w:ftr>',
    ].join('');

    expect(testInternals.addCachedFieldResults(xml)).toContain(
      '<w:fldChar w:fldCharType="separate"/><w:t>1</w:t><w:fldChar w:fldCharType="end"/>',
    );
  });

  it('does not double-inject when a cached result already exists', () => {
    const xml = [
      '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:p><w:r><w:fldChar w:fldCharType="separate"/></w:r>',
      '<w:r><w:t>1</w:t></w:r>',
      '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
      '</w:ftr>',
    ].join('');

    expect(testInternals.addCachedFieldResults(xml)).toBe(xml);
  });

  it('removes empty comments.xml and its package references', async () => {
    const buffer = await makeDocx({
      comments: commentsXml(''),
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    expect(zip.file('word/comments.xml')).toBeNull();
    await expect(zip.file('[Content_Types].xml').async('string')).resolves.not.toContain('/word/comments.xml');
    await expect(zip.file('word/_rels/document.xml.rels').async('string')).resolves.not.toContain('comments.xml');
  });

  it('preserves non-empty comments.xml parts', async () => {
    const buffer = await makeDocx({
      comments: commentsXml('<w:comment w:id="1" w:author="OA"><w:p/></w:comment>'),
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    expect(zip.file('word/comments.xml')).not.toBeNull();
    await expect(zip.file('[Content_Types].xml').async('string')).resolves.toContain('/word/comments.xml');
  });

  it('produces output that passes the structural linter', async () => {
    const buffer = await makeDocx({
      comments: commentsXml(''),
      footer: [
        '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
        '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>',
        '<w:r><w:instrText> PAGE </w:instrText></w:r>',
        '<w:r><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r></w:p>',
        '</w:ftr>',
      ].join(''),
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const result = await lintDocx(writeTempDocx(processed));

    expect(result.issues).toEqual([]);
  });
});

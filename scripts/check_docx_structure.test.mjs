import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';

import { lintDocx, lintDocxInputs } from './check_docx_structure.mjs';

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

async function writeDocx(parts) {
  const dir = mkdtempSync(join(tmpdir(), 'oa-docx-structure-'));
  tempDirs.push(dir);

  const zip = new JSZip();
  // Default fixture: theme + webSettings present AND registered in
  // [Content_Types].xml + document.xml.rels. Mirrors a real Word package so
  // the new UNREGISTERED_PART check doesn't false-positive on every test.
  // Individual tests that target MISSING_* / UNREGISTERED_PART build their
  // own fixtures directly.
  zip.file(
    '[Content_Types].xml',
    [
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
      '<Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>',
      '</Types>',
    ].join(''),
  );
  zip.file(
    'word/_rels/document.xml.rels',
    [
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>',
      '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>',
      '</Relationships>',
    ].join(''),
  );
  zip.file('word/document.xml', parts.document ?? documentXml('<w:p><w:r><w:t>OK</w:t></w:r></w:p>'));
  zip.file('word/theme/theme1.xml', '<a:theme/>');
  zip.file('word/webSettings.xml', '<w:webSettings/>');
  for (const [name, xml] of Object.entries(parts.extra ?? {})) {
    zip.file(name, xml);
  }
  if (parts.comments != null) {
    zip.file('word/comments.xml', parts.comments);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const path = join(dir, 'fixture.docx');
  writeFileSync(path, buffer);
  return path;
}

async function codesFor(path) {
  const result = await lintDocx(path);
  return result.issues.map((issue) => issue.code);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('check_docx_structure', () => {
  it('flags comments.xml parts with no w:comment children', async () => {
    const broken = await writeDocx({
      comments: commentsXml(''),
    });
    const good = await writeDocx({
      comments: commentsXml('<w:comment w:id="1" w:author="OA"><w:p><w:r><w:t>Note</w:t></w:r></w:p></w:comment>'),
    });

    expect(await codesFor(broken)).toContain('ORPHAN_COMMENTS_PART');
    expect(await codesFor(good)).not.toContain('ORPHAN_COMMENTS_PART');
  });

  it('flags field separate/end sequences without cached result text', async () => {
    const broken = await writeDocx({
      extra: {
        'word/footer1.xml': [
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
          '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>',
          '<w:r><w:instrText> PAGE </w:instrText></w:r>',
          '<w:r><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r></w:p>',
          '</w:ftr>',
        ].join(''),
      },
    });
    const good = await writeDocx({
      extra: {
        'word/footer1.xml': [
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
          '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>',
          '<w:r><w:instrText> PAGE </w:instrText></w:r>',
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
          '<w:r><w:t>1</w:t></w:r>',
          '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
          '</w:ftr>',
        ].join(''),
      },
    });

    expect(await codesFor(broken)).toContain('MISSING_CACHED_RESULT');
    expect(await codesFor(good)).not.toContain('MISSING_CACHED_RESULT');
  });

  it('flags document comment references without matching comments.xml definitions', async () => {
    const broken = await writeDocx({
      document: documentXml('<w:p><w:r><w:commentReference w:id="7"/></w:r></w:p>'),
      comments: commentsXml('<w:comment w:id="8" w:author="OA"><w:p/></w:comment>'),
    });
    const good = await writeDocx({
      document: documentXml('<w:p><w:r><w:commentReference w:id="7"/></w:r></w:p>'),
      comments: commentsXml('<w:comment w:id="7" w:author="OA"><w:p/></w:comment>'),
    });

    expect(await codesFor(broken)).toContain('ORPHAN_COMMENT_REFS');
    expect(await codesFor(good)).not.toContain('ORPHAN_COMMENT_REFS');
  });

  it('flags encoded apostrophe entities in body XML parts', async () => {
    const broken = await writeDocx({
      document: documentXml("<w:p><w:r><w:t>Company&apos;s option</w:t></w:r></w:p>"),
      extra: {
        'docProps/core.xml': '<cp:coreProperties><dc:title>Owner&apos;s copy</dc:title></cp:coreProperties>',
      },
    });
    const good = await writeDocx({
      document: documentXml("<w:p><w:r><w:t>Company's option</w:t></w:r></w:p>"),
      extra: {
        'docProps/core.xml': '<cp:coreProperties><dc:title>Owner&apos;s copy</dc:title></cp:coreProperties>',
      },
    });

    expect(await codesFor(broken)).toContain('ENCODED_APOSTROPHE_IN_BODY');
    expect(await codesFor(good)).not.toContain('ENCODED_APOSTROPHE_IN_BODY');
  });

  it('flags separate/end split across adjacent runs without cached result text', async () => {
    const broken = await writeDocx({
      extra: {
        'word/footer1.xml': [
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
          '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r>',
          '<w:r><w:instrText> PAGE </w:instrText></w:r>',
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
          '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>',
          '</w:ftr>',
        ].join(''),
      },
    });
    expect(await codesFor(broken)).toContain('MISSING_CACHED_RESULT');
  });

  it('flags expanded-empty fldChar elements (non-self-closing) without cached result text', async () => {
    const broken = await writeDocx({
      extra: {
        'word/footer1.xml': [
          '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
          '<w:p><w:r><w:fldChar w:fldCharType="begin"></w:fldChar></w:r>',
          '<w:r><w:instrText> PAGE </w:instrText></w:r>',
          '<w:r><w:fldChar w:fldCharType="separate"></w:fldChar>',
          '<w:fldChar w:fldCharType="end"></w:fldChar></w:r></w:p>',
          '</w:ftr>',
        ].join(''),
      },
    });
    expect(await codesFor(broken)).toContain('MISSING_CACHED_RESULT');
  });

  it('flags missing theme1.xml and webSettings.xml package parts', async () => {
    // Override the default fixture's theme/webSettings by removing them.
    const dir = mkdtempSync(join(tmpdir(), 'oa-docx-structure-missing-'));
    tempDirs.push(dir);
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    zip.file('word/document.xml', documentXml('<w:p><w:r><w:t>OK</w:t></w:r></w:p>'));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const path = join(dir, 'fixture.docx');
    writeFileSync(path, buffer);

    const codes = await codesFor(path);
    expect(codes).toContain('MISSING_THEME_PART');
    expect(codes).toContain('MISSING_WEBSETTINGS_PART');

    // Adding the parts clears the findings.
    expect(await codesFor(await writeDocx({}))).not.toContain('MISSING_THEME_PART');
    expect(await codesFor(await writeDocx({}))).not.toContain('MISSING_WEBSETTINGS_PART');
  });

  it('flags theme/webSettings parts that exist but are not registered in Content_Types or rels', async () => {
    // Build a fixture with both files present but unregistered — the failure
    // mode that survives a string-replace bug in the post-processor.
    const dir = mkdtempSync(join(tmpdir(), 'oa-docx-structure-unregistered-'));
    tempDirs.push(dir);
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    );
    zip.file(
      'word/_rels/document.xml.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    );
    zip.file('word/document.xml', documentXml('<w:p><w:r><w:t>OK</w:t></w:r></w:p>'));
    zip.file('word/theme/theme1.xml', '<a:theme/>');
    zip.file('word/webSettings.xml', '<w:webSettings/>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const path = join(dir, 'fixture.docx');
    writeFileSync(path, buffer);

    const result = await lintDocx(path);
    const unregistered = result.issues.filter((i) => i.code === 'UNREGISTERED_PART');
    // Expect 4 findings: theme + webSettings, each missing from BOTH Content_Types and rels.
    expect(unregistered.length).toBe(4);
    expect(unregistered.map((i) => i.details.partPath)).toEqual(
      expect.arrayContaining(['word/theme/theme1.xml', 'word/webSettings.xml']),
    );

    // The default fixture (where both are registered) produces no UNREGISTERED_PART.
    expect(await codesFor(await writeDocx({}))).not.toContain('UNREGISTERED_PART');
  });

  it('records a READ_ERROR for missing files but continues processing the rest', async () => {
    const good = await writeDocx({});
    const summary = await lintDocxInputs(['/path/does/not/exist.docx', good]);
    expect(summary.files.length).toBe(2);
    const codes = summary.results.flatMap((r) => r.issues.map((i) => i.code));
    expect(codes).toContain('READ_ERROR');
    // The valid file was still inspected (no issues, but appears in results).
    expect(summary.results.find((r) => r.path === good)?.issues).toEqual([]);
  });
});

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

function stylesXml(styles) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    styles,
    '</w:styles>',
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

  it('flags visible unstyled paragraphs whose inline alignment may be dropped by Pages', async () => {
    const broken = await writeDocx({
      document: documentXml(
        [
          '<w:p>',
          '<w:pPr><w:jc w:val="center"/></w:pPr>',
          '<w:r><w:t>Centered without pStyle</w:t></w:r>',
          '</w:p>',
        ].join(''),
      ),
      extra: {
        'word/styles.xml': stylesXml(
          '<w:style w:type="paragraph" w:styleId="OATitle"><w:pPr><w:jc w:val="center"/></w:pPr></w:style>',
        ),
      },
    });
    const good = await writeDocx({
      document: documentXml(
        [
          '<w:p>',
          '<w:pPr><w:pStyle w:val="OATitle"/><w:jc w:val="center"/></w:pPr>',
          '<w:r><w:t>Centered with pStyle</w:t></w:r>',
          '</w:p>',
        ].join(''),
      ),
    });

    expect(await codesFor(broken)).toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
    expect(await codesFor(good)).not.toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
  });

  it('flags visible unstyled paragraphs that follow a visibly styled paragraph', async () => {
    const broken = await writeDocx({
      document: documentXml(
        [
          '<w:p><w:pPr><w:pStyle w:val="OAClauseHeading"/></w:pPr><w:r><w:t>Heading</w:t></w:r></w:p>',
          '<w:p><w:r><w:t>Body that could inherit heading formatting</w:t></w:r></w:p>',
        ].join(''),
      ),
      extra: {
        'word/styles.xml': stylesXml(
          [
            '<w:style w:type="paragraph" w:styleId="OAClauseHeading">',
            '<w:name w:val="OA Clause Heading"/>',
            '<w:pPr><w:jc w:val="center"/></w:pPr>',
            '<w:rPr><w:b/><w:u w:val="single"/></w:rPr>',
            '</w:style>',
          ].join(''),
        ),
      },
    });
    const good = await writeDocx({
      document: documentXml(
        [
          '<w:p><w:pPr><w:pStyle w:val="OABody"/></w:pPr><w:r><w:t>Styled body</w:t></w:r></w:p>',
          '<w:p><w:r><w:t>Benign unstyled body</w:t></w:r></w:p>',
        ].join(''),
      ),
      extra: {
        'word/styles.xml': stylesXml(
          [
            '<w:style w:type="paragraph" w:styleId="OABody">',
            '<w:name w:val="OA Body"/>',
            '<w:pPr><w:spacing w:after="160"/></w:pPr>',
            '<w:rPr><w:color w:val="111111"/></w:rPr>',
            '</w:style>',
            '<w:style w:type="paragraph" w:styleId="OATitle">',
            '<w:name w:val="OA Title"/>',
            '<w:pPr><w:jc w:val="center"/></w:pPr>',
            '</w:style>',
          ].join(''),
        ),
      },
    });

    expect(await codesFor(broken)).toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
    expect(await codesFor(good)).not.toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
  });

  it('resolves w:basedOn so an inherited visible property still flags the following paragraph', async () => {
    const broken = await writeDocx({
      document: documentXml(
        [
          '<w:p><w:pPr><w:pStyle w:val="OASubHeading"/></w:pPr><w:r><w:t>Sub heading</w:t></w:r></w:p>',
          '<w:p><w:r><w:t>Body that could inherit bold from the base style</w:t></w:r></w:p>',
        ].join(''),
      ),
      extra: {
        'word/styles.xml': stylesXml(
          [
            // OASubHeading carries no direct visible props, but inherits bold
            // from OAHeadingBase via w:basedOn — must still be detected.
            '<w:style w:type="paragraph" w:styleId="OAHeadingBase"><w:rPr><w:b/></w:rPr></w:style>',
            '<w:style w:type="paragraph" w:styleId="OASubHeading"><w:basedOn w:val="OAHeadingBase"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>',
          ].join(''),
        ),
      },
    });

    expect(await codesFor(broken)).toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
  });

  it('does not flag an unstyled paragraph in a new table cell after a styled paragraph in the previous cell', async () => {
    const good = await writeDocx({
      document: documentXml(
        [
          '<w:tbl>',
          '<w:tr><w:tc>',
          '<w:p><w:pPr><w:pStyle w:val="OAClauseHeading"/></w:pPr><w:r><w:t>Heading in cell one</w:t></w:r></w:p>',
          '</w:tc></w:tr>',
          '<w:tr><w:tc>',
          '<w:p><w:r><w:t>Plain body in cell two</w:t></w:r></w:p>',
          '</w:tc></w:tr>',
          '</w:tbl>',
        ].join(''),
      ),
      extra: {
        'word/styles.xml': stylesXml(
          [
            '<w:style w:type="paragraph" w:styleId="OAClauseHeading"><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>',
            '<w:style w:type="paragraph" w:styleId="OATitle"><w:pPr><w:jc w:val="center"/></w:pPr></w:style>',
          ].join(''),
        ),
      },
    });

    expect(await codesFor(good)).not.toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
  });

  it('does not flag an unstyled paragraph after a section break that ends a styled paragraph', async () => {
    const good = await writeDocx({
      document: documentXml(
        [
          // Last paragraph of section 1: styled heading carrying the w:sectPr
          // *inside* its pPr (the common WordprocessingML shape).
          '<w:p><w:pPr><w:pStyle w:val="OAClauseHeading"/><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr><w:r><w:t>Heading ending section one</w:t></w:r></w:p>',
          // Section 2's first paragraph — must NOT inherit across the break.
          '<w:p><w:r><w:t>New section body</w:t></w:r></w:p>',
        ].join(''),
      ),
      extra: {
        'word/styles.xml': stylesXml(
          [
            '<w:style w:type="paragraph" w:styleId="OAClauseHeading"><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>',
            '<w:style w:type="paragraph" w:styleId="OATitle"><w:pPr><w:jc w:val="center"/></w:pPr></w:style>',
          ].join(''),
        ),
      },
    });

    expect(await codesFor(good)).not.toContain('MISSING_PSTYLE_ON_VISIBLE_PARAGRAPH');
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

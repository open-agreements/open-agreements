import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  zip.file('word/document.xml', parts.document ?? documentXml('<w:p><w:r><w:t>OK</w:t></w:r></w:p>'));
  zip.file('word/footer1.xml', parts.footer ?? '');
  for (const [name, value] of Object.entries(parts.extra ?? {})) {
    zip.file(name, value);
  }
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

  /**
   * @quirk Word for Mac's "unreadable content" repair dialog fires on
   *   `&apos;` in body text. The entity is technically valid XML 1.0 (one
   *   of the five predefined references) but Word rejects it where the
   *   other four (`&amp;`, `&lt;`, `&gt;`, `&quot;`) are accepted. Bisected
   *   in May 2026 against the dev-website-served file (which opens clean
   *   because its xmldom round-trip incidentally decodes the entity) vs.
   *   the OA repo file (which Word rejects).
   *
   * @misconception "An XML serializer that emits `&apos;` is correct, so
   *   Word must be wrong to reject it." Both statements are true — and
   *   neither helps the user, who sees a scary repair dialog on a file we
   *   shipped. The post-processor swaps `&apos;` for the literal
   *   apostrophe character in every `.xml` part to interoperate with
   *   Word's quirk. Non-XML parts (e.g. `word/media/readme.txt`) are
   *   intentionally untouched — `&apos;` in those is just text.
   *
   * @see https://github.com/dolanmiu/docx/issues/2443
   *   "Corrupt Word document from patching with an XML attribute with an
   *   ampersand" — same root cause: the docx library's underlying
   *   `xml-js` serializer round-trips entity references inconsistently.
   * @see https://github.com/dolanmiu/docx/issues/3314
   *   "Word found unreadable content error" (Nov 2025) — recurring report
   *   of the same dialog; no upstream fix yet.
   * @see https://github.com/nashwaan/xml-js/issues/69 — upstream xml-js bug.
   */
  it('decodes &apos; entities in XML parts only', async () => {
    const buffer = await makeDocx({
      document: documentXml("<w:p><w:r><w:t>Company&apos;s option</w:t></w:r></w:p>"),
      extra: {
        'docProps/core.xml': '<cp:coreProperties><dc:title>Owner&apos;s copy</dc:title></cp:coreProperties>',
        'word/media/readme.txt': 'Keep &apos; encoded here',
      },
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    await expect(zip.file('word/document.xml').async('string')).resolves.toContain("Company's option");
    await expect(zip.file('docProps/core.xml').async('string')).resolves.toContain("Owner's copy");
    await expect(zip.file('word/media/readme.txt').async('string')).resolves.toContain('Keep &apos; encoded here');
  });

  /**
   * @quirk A naive `&apos;` → `'` swap would corrupt XML if the part used
   *   single-quoted attribute values. For example,
   *   `<w:p data-owner='Owner&apos;s'>` would become
   *   `<w:p data-owner='Owner's'>` — unbalanced quotes, no longer parseable.
   *
   * @misconception "Single-quoted attributes don't appear in our output, so
   *   we don't have to handle them." True today (the `docx` library
   *   exclusively emits double-quoted attributes), but treating that as a
   *   stable invariant relies on an upstream library's serialization choice.
   *   The defensive precondition + linter check together preserve the
   *   invariant explicitly: if single-quoted attributes ever appear, the
   *   post-processor self-protects by leaving the part untouched, and the
   *   `ENCODED_APOSTROPHE_IN_BODY` linter check surfaces the residual
   *   `&apos;` at the next CI run so we know to investigate.
   *
   * Caught by Codex peer-review of #370 (May 2026); see review thread.
   */
  it('skips parts with single-quoted attributes (defensive, leaves &apos; in place)', async () => {
    const buffer = await makeDocx({
      document:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        "<w:body><w:p data-owner='Owner&apos;s'><w:r><w:t>OK</w:t></w:r></w:p></w:body>" +
        '</w:document>',
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    // The single-quoted attribute is preserved, AND the &apos; inside it is
    // left encoded — corrupting it would unbalance the attribute value.
    const docXml = await zip.file('word/document.xml').async('string');
    expect(docXml).toContain("data-owner='Owner&apos;s'");
  });

  /**
   * @quirk Round-2 peer-review (Codex, May 2026) caught that an earlier
   *   form of {@link hasSingleQuotedAttribute} matched the XML declaration
   *   `<?xml version='1.0' encoding='UTF-8'?>` and suppressed `&apos;`
   *   decoding for any part that happened to use single-quoted declaration
   *   attributes (which is valid XML). The regex now requires `<` followed
   *   by a letter (an element-name start), so processing instructions and
   *   comments are excluded.
   *
   * @misconception "The XML declaration is just metadata; the regex doesn't
   *   need to care about it." Wrong: the declaration is syntactically a
   *   `<...>` tag, and a permissive `<[^>]*='` matches it. Test pins the
   *   fix so future regex changes don't silently regress this case.
   */
  it('decodes &apos; even when the XML declaration uses single quotes', async () => {
    const buffer = await makeDocx({
      document:
        "<?xml version='1.0' encoding='UTF-8' standalone='yes'?>" +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:body><w:p><w:r><w:t>Owner&apos;s option</w:t></w:r></w:p></w:body>' +
        '</w:document>',
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);
    const docXml = await zip.file('word/document.xml').async('string');

    // &apos; in text content was decoded; the single-quoted XML declaration
    // doesn't constitute a single-quoted element attribute, so the
    // defensive guard correctly stayed out of the way.
    expect(docXml).toContain("Owner's option");
    expect(docXml).not.toContain('&apos;');
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

  /**
   * @quirk Word for Mac's repair dialog fires when `word/theme/theme1.xml`
   *   or `word/webSettings.xml` is absent, even though ECMA-376 marks both
   *   optional. The `docx` npm library v9.5.1 emits neither. The
   *   post-processor injects byte-identical copies of the Common Paper
   *   reference fixtures (known-good shapes that Word for Mac accepts).
   *
   * @see issue #373 — bisect via /tmp/variant-D-wyoming.docx confirmed
   *   the dialog disappears when both parts are added.
   */
  it('injects theme1.xml + webSettings.xml + Content_Types overrides + rels when missing', async () => {
    const buffer = await makeDocx();
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    expect(zip.file('word/theme/theme1.xml')).not.toBeNull();
    expect(zip.file('word/webSettings.xml')).not.toBeNull();

    const contentTypes = await zip.file('[Content_Types].xml').async('string');
    expect(contentTypes).toContain('PartName="/word/theme/theme1.xml"');
    expect(contentTypes).toContain(
      'ContentType="application/vnd.openxmlformats-officedocument.theme+xml"',
    );
    expect(contentTypes).toContain('PartName="/word/webSettings.xml"');
    expect(contentTypes).toContain(
      'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"',
    );

    const rels = await zip.file('word/_rels/document.xml.rels').async('string');
    expect(rels).toContain('Target="theme/theme1.xml"');
    expect(rels).toContain('Target="webSettings.xml"');
    // makeDocx fixture uses rId6; max+1 allocation produces rId7 then rId8.
    expect(rels).toContain('Id="rId7"');
    expect(rels).toContain('Id="rId8"');
  });

  it('does not duplicate package parts when already present', async () => {
    const buffer = await makeDocx({
      extra: {
        'word/theme/theme1.xml': '<a:theme/>',
        'word/webSettings.xml': '<w:webSettings/>',
        '[Content_Types].xml': [
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
          '<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
          '<Override PartName="/word/webSettings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml"/>',
          '</Types>',
        ].join(''),
        'word/_rels/document.xml.rels': [
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
          '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>',
          '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>',
          '</Relationships>',
        ].join(''),
      },
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    const contentTypes = await zip.file('[Content_Types].xml').async('string');
    const themeOverrideCount = (contentTypes.match(/PartName="\/word\/theme\/theme1\.xml"/g) ?? []).length;
    const webSettingsOverrideCount = (contentTypes.match(/PartName="\/word\/webSettings\.xml"/g) ?? []).length;
    expect(themeOverrideCount).toBe(1);
    expect(webSettingsOverrideCount).toBe(1);

    const rels = await zip.file('word/_rels/document.xml.rels').async('string');
    const themeRelCount = (rels.match(/Target="theme\/theme1\.xml"/g) ?? []).length;
    const webSettingsRelCount = (rels.match(/Target="webSettings\.xml"/g) ?? []).length;
    expect(themeRelCount).toBe(1);
    expect(webSettingsRelCount).toBe(1);

    // The pre-existing minimal stub bytes are preserved — we don't overwrite
    // a part that already exists at the target path.
    await expect(zip.file('word/theme/theme1.xml').async('string')).resolves.toBe('<a:theme/>');
    await expect(zip.file('word/webSettings.xml').async('string')).resolves.toBe('<w:webSettings/>');
  });

  it('adds only the missing part when one of theme/webSettings is already present', async () => {
    // Mirrors the common-paper-ai-addendum / common-paper-term-sheet pattern:
    // hand-authored template that ships theme1.xml but is missing webSettings.xml.
    const buffer = await makeDocx({
      extra: {
        'word/theme/theme1.xml': '<a:theme/>',
        '[Content_Types].xml': [
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
          '<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
          '</Types>',
        ].join(''),
        'word/_rels/document.xml.rels': [
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
          '<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>',
          '</Relationships>',
        ].join(''),
      },
    });
    const processed = await postProcessGeneratedDocx(buffer);
    const zip = await JSZip.loadAsync(processed);

    // Existing theme is untouched (no rewrite of contents).
    await expect(zip.file('word/theme/theme1.xml').async('string')).resolves.toBe('<a:theme/>');
    // Missing webSettings is now present.
    expect(zip.file('word/webSettings.xml')).not.toBeNull();

    const rels = await zip.file('word/_rels/document.xml.rels').async('string');
    // max(existing) = 11, so next allocated rId is rId12.
    expect(rels).toContain('Id="rId12"');
    expect(rels).toContain('Target="webSettings.xml"');
  });

  it('post-processes a real cover-standard template buffer end-to-end', async () => {
    // Strip theme/webSettings out of the on-disk board-consent template to
    // simulate the pre-fix state, then post-process and verify the parts
    // are re-injected with correct package references. Using the real
    // buffer (rather than the in-memory `makeDocx` fixture) exercises the
    // single-line `[Content_Types].xml` / `document.xml.rels` formatting
    // that the `docx` npm library actually emits.
    const realPath = resolve(
      'templates/openagreements-cc-by-4.0/openagreements-board-consent-safe/template.docx',
    );
    const original = await JSZip.loadAsync(readFileSync(realPath));
    original.remove('word/theme/theme1.xml');
    original.remove('word/webSettings.xml');
    let contentTypes = await original.file('[Content_Types].xml').async('string');
    contentTypes = contentTypes
      .replace(/<Override[^>]*PartName="\/word\/theme\/theme1\.xml"[^>]*\/>/, '')
      .replace(/<Override[^>]*PartName="\/word\/webSettings\.xml"[^>]*\/>/, '');
    original.file('[Content_Types].xml', contentTypes);
    let rels = await original.file('word/_rels/document.xml.rels').async('string');
    rels = rels
      .replace(/<Relationship[^>]*Target="theme\/theme1\.xml"[^>]*\/>/, '')
      .replace(/<Relationship[^>]*Target="webSettings\.xml"[^>]*\/>/, '');
    original.file('word/_rels/document.xml.rels', rels);
    const stripped = await original.generateAsync({ type: 'nodebuffer' });

    const before = await JSZip.loadAsync(stripped);
    expect(before.file('word/theme/theme1.xml')).toBeNull();
    expect(before.file('word/webSettings.xml')).toBeNull();

    const processed = await postProcessGeneratedDocx(stripped);
    const after = await JSZip.loadAsync(processed);

    expect(after.file('word/theme/theme1.xml')).not.toBeNull();
    expect(after.file('word/webSettings.xml')).not.toBeNull();

    const afterContentTypes = await after.file('[Content_Types].xml').async('string');
    expect(afterContentTypes).toContain('PartName="/word/theme/theme1.xml"');
    expect(afterContentTypes).toContain('PartName="/word/webSettings.xml"');

    // Linter sees the post-processed buffer as clean — no MISSING_* findings.
    const result = await lintDocx(writeTempDocx(processed));
    expect(result.issues).toEqual([]);
  });
});

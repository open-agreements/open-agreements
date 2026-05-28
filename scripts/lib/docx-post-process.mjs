import JSZip from 'jszip';

function hasCommentChildren(xml) {
  return /<w:comment(?=[\s>])[^>]*>/i.test(xml);
}

function relevantXmlPart(name) {
  return /\.xml$/i.test(name) && /(?:^|\/)(document|header\d*|footer\d*)\.xml$/i.test(name);
}

function fieldCharPattern(type) {
  return `(<w:fldChar\\b[^>]*(?:\\bw:fldCharType="${type}"|\\b${type}\\b)[^>]*(?:\\/>|>\\s*<\\/w:fldChar\\s*>))`;
}

function addCachedFieldResults(xml) {
  const separate = fieldCharPattern('separate');
  const end = fieldCharPattern('end');
  const between = '(\\s*(?:<\\/w:r>\\s*<w:r\\b[^>]*>\\s*)?)';
  const missingResult = new RegExp(`${separate}${between}${end}`, 'gi');

  return xml.replace(missingResult, (_match, separateXml, betweenXml, endXml) => {
    return `${separateXml}<w:t>1</w:t>${betweenXml}${endXml}`;
  });
}

/**
 * Decode `&apos;` XML entities in every `.xml` part to literal `'`.
 *
 * @quirk Word for Mac's "unreadable content" repair pass flags `&apos;` in
 *   body text even though it is one of the five predefined XML 1.0 entity
 *   references (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`) and therefore
 *   strictly valid in any XML 1.0 document. The other four are accepted
 *   without complaint; only `&apos;` triggers the repair dialog. This is a
 *   Word interop quirk, not an OOXML schema violation.
 *
 * @misconception "Just emit the apostrophe as `'` everywhere" is the
 *   instinct, and it is correct. The reason the `docx` npm library emits
 *   `&apos;` at all is that its underlying XML serializer (`xml-js`)
 *   round-trips entity references inconsistently: it decodes them on
 *   parse but does not re-encode them on serialize, so any input string
 *   that already contains `&apos;` (or that the serializer chooses to
 *   encode that way for an apostrophe) ends up in the final XML. The
 *   apostrophe was never structurally required to be encoded; the
 *   library just doesn't normalize.
 *
 * @see https://github.com/dolanmiu/docx/issues/2443
 *   "Corrupt Word document from patching with an XML attribute with an
 *   ampersand" — same root cause: xml-js entity-encoding inconsistency
 *   produces docx files Word cannot read.
 * @see https://github.com/dolanmiu/docx/issues/3314
 *   "Word found unreadable content error" (Nov 2025) — recurring report of
 *   the same dialog from a minimal `Hello World` doc, no fix landed upstream.
 * @see https://github.com/dolanmiu/docx/issues/345
 *   "Escape bad characters" (older, closed) — original framing of the
 *   character-handling gap in the same library.
 * @see https://github.com/nashwaan/xml-js/issues/69
 *   The upstream xml-js bug.
 *
 * Replaces only the literal entity reference `&apos;`. Does NOT round-trip
 * the XML through a parser — that would also normalize whitespace,
 * attribute ordering, and namespace prefixes, risking changes far beyond
 * the intended fix.
 *
 * @param {import('jszip')} zip
 * @returns {Promise<boolean>} true if any part changed
 */
/**
 * Detect whether an XML part contains any single-quoted attribute values
 * on element start tags (`<tag attr='...'>` style). Returns true if so.
 *
 * Matches only element start tags (start with `<` + letter), NOT:
 *   - XML processing instructions: `<?xml version='1.0'?>`
 *   - Comments: `<!-- ='single' -->`
 *   - DOCTYPE: `<!DOCTYPE ...>`
 *   - CDATA sections: `<![CDATA[...]]>`
 *   - Text content with literal quotes: `<w:t>name='Alice'</w:t>`
 *
 * Used as a defensive precondition before {@link decodeApostropheEntities}
 * touches a part: replacing `&apos;` inside a single-quoted attribute
 * (`<tag attr='Owner&apos;s'>`) would corrupt the XML (`<tag attr='Owner's'>`
 * has an unbalanced quote). The `docx` library uses double-quoted attributes
 * exclusively, so this branch should be unreachable in practice. If it ever
 * fires, the part is left untouched (preserving any `&apos;` it contains)
 * and the structural linter's `ENCODED_APOSTROPHE_IN_BODY` check will
 * surface the residual entity at the next CI run.
 *
 * @quirk Caught in #370 round-2 peer-review (Codex): the earlier
 *   `<[^>]*=\s*'` form matched `<?xml version='1.0'?>` declarations and
 *   suppressed decoding for the entire part. Constrained to `<[A-Za-z]`
 *   (a real element-name start) to fix.
 */
function hasSingleQuotedAttribute(xml) {
  return /<[A-Za-z][^>]*=\s*'/.test(xml);
}

async function decodeApostropheEntities(zip) {
  const updates = [];
  let changed = false;
  for (const name of Object.keys(zip.files).sort()) {
    if (!/\.xml$/i.test(name)) continue;
    const part = zip.file(name);
    if (!part) continue;
    updates.push(
      part.async('string').then((xml) => {
        // Defensive: a blind `&apos;` → `'` swap inside a single-quoted
        // attribute (e.g. `attr='Owner&apos;s'`) would produce malformed XML
        // (`attr='Owner's'` has a stray apostrophe terminating the value).
        // Skip the swap on any part that uses single-quoted attributes; the
        // structural linter will catch the residual `&apos;` so we know to
        // fix the upstream emitter instead of silently corrupting output.
        if (hasSingleQuotedAttribute(xml)) {
          return;
        }
        const updated = xml.replaceAll('&apos;', "'");
        if (updated !== xml) {
          changed = true;
          zip.file(name, updated);
        }
      }),
    );
  }
  await Promise.all(updates);
  return changed;
}

function dropEmptyCommentsPart(zip) {
  const commentsPart = zip.file('word/comments.xml');
  if (!commentsPart) {
    return false;
  }

  return commentsPart.async('string').then((commentsXml) => {
    if (hasCommentChildren(commentsXml)) {
      return false;
    }

    zip.remove('word/comments.xml');

    const contentTypesPart = zip.file('[Content_Types].xml');
    const relsPart = zip.file('word/_rels/document.xml.rels');

    const updates = [];
    if (contentTypesPart) {
      updates.push(
        contentTypesPart.async('string').then((xml) => {
          zip.file(
            '[Content_Types].xml',
            xml.replace(
              /<Override\b[^>]*\bPartName="\/word\/comments\.xml"[^>]*(?:\/>|>\s*<\/Override\s*>)/gi,
              '',
            ),
          );
        }),
      );
    }

    if (relsPart) {
      updates.push(
        relsPart.async('string').then((xml) => {
          zip.file(
            'word/_rels/document.xml.rels',
            xml.replace(
              /<Relationship\b(?=[^>]*\bType="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/comments")(?=[^>]*\bTarget="comments\.xml")[^>]*(?:\/>|>\s*<\/Relationship\s*>)/gi,
              '',
            ),
          );
        }),
      );
    }

    return Promise.all(updates).then(() => true);
  });
}

async function addCachedResultsToFieldParts(zip) {
  const updates = [];
  let changed = false;
  for (const name of Object.keys(zip.files).sort()) {
    if (!relevantXmlPart(name)) continue;
    const part = zip.file(name);
    if (!part) continue;
    updates.push(
      part.async('string').then((xml) => {
        const updated = addCachedFieldResults(xml);
        if (updated !== xml) {
          changed = true;
          zip.file(name, updated);
        }
      }),
    );
  }
  await Promise.all(updates);
  return changed;
}

export async function postProcessGeneratedDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const changedFieldParts = await addCachedResultsToFieldParts(zip);
  const droppedCommentsPart = await dropEmptyCommentsPart(zip);
  const decodedApostropheEntities = await decodeApostropheEntities(zip);
  if (!changedFieldParts && !droppedCommentsPart && !decodedApostropheEntities) {
    return buffer;
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export const testInternals = {
  addCachedFieldResults,
  decodeApostropheEntities,
};

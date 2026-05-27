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
  if (!changedFieldParts && !droppedCommentsPart) {
    return buffer;
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export const testInternals = {
  addCachedFieldResults,
};

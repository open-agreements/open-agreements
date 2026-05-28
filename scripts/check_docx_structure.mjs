#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

const DEFAULT_PATTERN = 'content/templates/*/template.docx';

export const CHECKS = {
  ORPHAN_COMMENTS_PART: {
    name: 'ORPHAN_COMMENTS_PART',
    description: 'word/comments.xml exists but contains no w:comment children.',
  },
  MISSING_CACHED_RESULT: {
    name: 'MISSING_CACHED_RESULT',
    description: 'A field separate marker is followed by field end without cached result text.',
  },
  ORPHAN_COMMENT_REFS: {
    name: 'ORPHAN_COMMENT_REFS',
    description: 'document.xml references comment IDs that are not defined in comments.xml.',
  },
  ENCODED_APOSTROPHE_IN_BODY: {
    name: 'ENCODED_APOSTROPHE_IN_BODY',
    description: 'Body XML contains &apos; entity references that trigger Word repair prompts.',
  },
};

function parseArgs(argv) {
  const parsed = {
    format: 'text',
    patterns: [],
    help: false,
    allowEmpty: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--format=json' || arg === '--json') {
      parsed.format = 'json';
      continue;
    }
    if (arg.startsWith('--format=')) {
      const format = arg.slice('--format='.length);
      if (!['text', 'json'].includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }
      parsed.format = format;
      continue;
    }
    if (arg === '--allow-empty') {
      parsed.allowEmpty = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    parsed.patterns.push(arg);
  }

  if (parsed.patterns.length === 0) {
    parsed.patterns.push(DEFAULT_PATTERN);
  }

  return parsed;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/check_docx_structure.mjs [--format=text|json] [docx path or glob ...]',
      '',
      'Runs lightweight OOXML structural checks for Word unreadable-content failure modes.',
      '',
      'Defaults to: content/templates/*/template.docx',
      '',
      'Options:',
      '      --format=json   Emit machine-readable JSON output',
      '      --json          Alias for --format=json',
      '      --allow-empty   Exit 0 when no files match (default: exit 1)',
      '  -h, --help          Show help',
    ].join('\n'),
  );
}

function hasGlobMagic(pattern) {
  return /[*?\[]/.test(pattern);
}

function globSegmentToRegExp(segment) {
  let source = '^';
  for (const char of segment) {
    if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function splitPathLike(value) {
  return value.replaceAll('\\', '/').split('/').filter((part) => part.length > 0);
}

function globBase(pattern) {
  const absolute = resolve(pattern);
  const parts = splitPathLike(absolute);
  const baseParts = [];
  for (const part of parts) {
    if (hasGlobMagic(part)) break;
    baseParts.push(part);
  }
  return resolve(`${absolute.startsWith('/') ? '/' : ''}${baseParts.join('/') || '.'}`);
}

function walkGlob(dir, segments, index, matches) {
  if (index >= segments.length) {
    if (existsSync(dir) && statSync(dir).isFile()) {
      matches.push(dir);
    }
    return;
  }

  const segment = segments[index];
  if (segment === '**') {
    walkGlob(dir, segments, index + 1, matches);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walkGlob(resolve(dir, entry.name), segments, index, matches);
      }
    }
    return;
  }

  if (!hasGlobMagic(segment)) {
    walkGlob(resolve(dir, segment), segments, index + 1, matches);
    return;
  }

  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  const re = globSegmentToRegExp(segment);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (re.test(entry.name)) {
      walkGlob(resolve(dir, entry.name), segments, index + 1, matches);
    }
  }
}

export function expandInputs(inputs) {
  const paths = new Set();

  for (const input of inputs) {
    if (!hasGlobMagic(input)) {
      paths.add(resolve(input));
      continue;
    }

    const base = globBase(input);
    const baseParts = splitPathLike(base);
    const patternParts = splitPathLike(resolve(input));
    const matches = [];
    walkGlob(base, patternParts.slice(baseParts.length), 0, matches);
    for (const match of matches) {
      paths.add(match);
    }
  }

  return [...paths].sort();
}

function hasCommentChildren(xml) {
  return /<w:comment(?=[\s>])[^>]*>/i.test(xml);
}

function collectCommentIds(xml, tagName) {
  return new Set(
    [...xml.matchAll(new RegExp(`<w:${tagName}\\b[^>]*\\bw:id="([^"]+)"`, 'gi'))]
      .map((match) => match[1]),
  );
}

function missingCachedResultOffsets(xml) {
  // Matches a w:fldChar separate marker immediately followed by a w:fldChar end
  // marker with no cached result text between them. Tolerates:
  //   - Self-closing and expanded-empty element forms (<w:fldChar .../> | <w:fldChar ...></w:fldChar>)
  //   - One run-boundary between the two fldChars (</w:r> ... <w:r>) since some
  //     serializers split adjacent fldChars across separate runs even when no
  //     cached result is emitted between them.
  // Does NOT match when any non-whitespace, non-run-boundary text appears in
  // between (e.g. <w:r><w:t>1</w:t></w:r>), which is the valid cached-result case.
  const fldChar = (type) =>
    `<w:fldChar\\b[^>]*(?:\\bw:fldCharType="${type}"|\\b${type}\\b)[^>]*(?:\\/>|>\\s*</w:fldChar\\s*>)`;
  const between = '\\s*(?:</w:r>\\s*<w:r\\b[^>]*>\\s*)?';
  const re = new RegExp(`${fldChar('separate')}${between}${fldChar('end')}`, 'gi');
  return [...xml.matchAll(re)].map((match) => match.index ?? 0);
}

function relevantXmlPart(name) {
  return /\.xml$/i.test(name) && /(?:^|\/)(document|header\d*|footer\d*)\.xml$/i.test(name);
}

function bodyXmlPart(name) {
  return (
    /\.xml$/i.test(name) &&
    /(?:^|\/)(document|header\d*|footer\d*|endnotes|footnotes|comments)\.xml$/i.test(name)
  );
}

/**
 * Find offsets of `&apos;` entity references in a body XML part.
 *
 * @quirk Word for Mac's "unreadable content" repair dialog fires on
 *   `&apos;` in body text even though it is a predefined XML 1.0 entity
 *   reference. Bisected May 2026; the other four predefined entities
 *   (`&amp;`, `&lt;`, `&gt;`, `&quot;`) are accepted without complaint.
 *
 * @misconception This is not catching invalid XML — the file is
 *   well-formed and schema-valid. It is catching a Word interop pitfall.
 *   Treat the rule as "ship docx files Word for Mac will open without
 *   complaining", not "ship XML that meets the OOXML schema". See the
 *   companion post-processor in `scripts/lib/docx-post-process.mjs` which
 *   strips these on the way out.
 *
 * @see https://github.com/dolanmiu/docx/issues/2443
 * @see https://github.com/dolanmiu/docx/issues/3314
 * @see https://github.com/nashwaan/xml-js/issues/69
 */
function encodedApostropheOffsets(xml) {
  return [...xml.matchAll(/&apos;/g)].map((match) => match.index ?? 0);
}

function issue(code, part, details = {}) {
  return {
    code,
    name: CHECKS[code].name,
    description: CHECKS[code].description,
    part,
    details,
  };
}

export async function lintDocx(docxPath) {
  const absolutePath = resolve(docxPath);
  const zip = await JSZip.loadAsync(readFileSync(absolutePath));
  const issues = [];

  const commentsPart = zip.file('word/comments.xml');
  let commentsXml = null;
  if (commentsPart) {
    commentsXml = await commentsPart.async('string');
    if (!hasCommentChildren(commentsXml)) {
      issues.push(issue('ORPHAN_COMMENTS_PART', 'word/comments.xml'));
    }
  }

  for (const name of Object.keys(zip.files).sort()) {
    if (!relevantXmlPart(name) && !bodyXmlPart(name)) continue;
    const part = zip.file(name);
    if (!part) continue;
    const xml = await part.async('string');
    if (relevantXmlPart(name)) {
      for (const offset of missingCachedResultOffsets(xml)) {
        issues.push(issue('MISSING_CACHED_RESULT', name, { offset }));
      }
    }
    if (bodyXmlPart(name)) {
      for (const offset of encodedApostropheOffsets(xml)) {
        issues.push(issue('ENCODED_APOSTROPHE_IN_BODY', name, { offset }));
      }
    }
  }

  const documentPart = zip.file('word/document.xml');
  if (documentPart) {
    const documentXml = await documentPart.async('string');
    const refIds = collectCommentIds(documentXml, 'commentReference');
    if (refIds.size > 0) {
      const definedIds = collectCommentIds(commentsXml ?? '', 'comment');
      const missingIds = [...refIds].filter((id) => !definedIds.has(id));
      if (missingIds.length > 0) {
        issues.push(issue('ORPHAN_COMMENT_REFS', 'word/document.xml', { missingIds }));
      }
    }
  }

  return {
    path: absolutePath,
    issues,
  };
}

export async function lintDocxInputs(inputs) {
  const files = expandInputs(inputs);
  const results = [];

  for (const file of files) {
    try {
      results.push(await lintDocx(file));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        path: resolve(file),
        issues: [
          {
            code: 'READ_ERROR',
            name: 'READ_ERROR',
            description: `Could not read docx: ${message}`,
            part: file,
            details: { error: message },
          },
        ],
      });
    }
  }

  return {
    files,
    results,
    issueCount: results.reduce((sum, result) => sum + result.issues.length, 0),
  };
}

function printText(summary) {
  if (summary.files.length === 0) {
    console.log('DOCX structure check');
    console.log('No DOCX files matched.');
    return;
  }

  console.log('DOCX structure check');
  for (const result of summary.results) {
    const displayPath = relative(process.cwd(), result.path) || result.path.split(sep).pop();
    console.log(displayPath);
    if (result.issues.length === 0) {
      console.log('  OK');
      continue;
    }
    for (const found of result.issues) {
      const details = found.details?.missingIds
        ? ` missing IDs: ${found.details.missingIds.join(', ')}`
        : '';
      console.log(`  ${found.code} (${found.part})${details}`);
      console.log(`    ${found.description}`);
    }
  }

  const fileCount = summary.results.length;
  const failingFileCount = summary.results.filter((result) => result.issues.length > 0).length;
  console.log(
    `Summary: ${summary.issueCount} finding${summary.issueCount === 1 ? '' : 's'} across ${failingFileCount}/${fileCount} file${fileCount === 1 ? '' : 's'}.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const summary = await lintDocxInputs(args.patterns);
  if (args.format === 'json') {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printText(summary);
  }

  if (summary.files.length === 0 && !args.allowEmpty) {
    console.error(
      `check_docx_structure: no docx files matched patterns ${JSON.stringify(args.patterns)}. ` +
        'Pass --allow-empty to suppress this failure.',
    );
    process.exitCode = 1;
    return;
  }

  if (summary.issueCount > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`check_docx_structure failed: ${message}`);
    process.exitCode = 1;
  }
}

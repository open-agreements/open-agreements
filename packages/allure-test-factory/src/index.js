import { expect, it as vitestIt, test as vitestTest } from 'vitest';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import Prism from 'prismjs';
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import 'prismjs/components/prism-json.js';

// ── Content-type constants ──────────────────────────────────────────────────

const JSON_CONTENT_TYPE = 'application/json';
const TEXT_CONTENT_TYPE = 'text/plain';
const MARKDOWN_CONTENT_TYPE = 'text/markdown';
const HTML_CONTENT_TYPE = 'text/html';

// ── Prism.js performance guard ──────────────────────────────────────────────

const PRISM_JSON_SIZE_LIMIT = 512 * 1024; // 512 KB

// ── Module-level helpers (stateless) ────────────────────────────────────────

export function getAllureRuntime() {
  return globalThis.allure;
}

export function escapeForHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ── XML pretty-printing ────────────────────────────────────────────────────

const XML_PRETTY_PRINT_PARSER = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  processEntities: false,
});

const XML_PRETTY_PRINT_BUILDER = new XMLBuilder({
  ignoreAttributes: false,
  preserveOrder: true,
  processEntities: false,
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
});

function formatXmlForDisplay(xml) {
  const source = String(xml).trim();
  if (source.length === 0) {
    return '';
  }
  try {
    return XML_PRETTY_PRINT_BUILDER.build(XML_PRETTY_PRINT_PARSER.parse(source));
  } catch {
    return source;
  }
}

// ── Prism.js highlighting ───────────────────────────────────────────────────

function highlightXmlForHtml(xml) {
  const source = String(xml);
  const language = Prism.languages.xml ?? Prism.languages.markup;
  if (!language) {
    return escapeForHtml(source);
  }
  try {
    return Prism.highlight(source, language, 'xml');
  } catch {
    return escapeForHtml(source);
  }
}

function highlightJsonForHtml(json) {
  const source = String(json);
  if (source.length > PRISM_JSON_SIZE_LIMIT) {
    return escapeForHtml(source);
  }
  const language = Prism.languages.json;
  if (!language) {
    return escapeForHtml(source);
  }
  try {
    return Prism.highlight(source, language, 'json');
  } catch {
    return escapeForHtml(source);
  }
}

// ── HTML builders (exported) ────────────────────────────────────────────────

export function buildHtmlAttachment(body, extraStyles = '') {
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    '<style>',
    ':root{--atf-text:#374151;--atf-text-muted:#6b7280;--atf-text-heading:#111827;--atf-bg-code:#f3f4f6;--atf-border:#d1d5db;--atf-bg-panel:#ffffff;--atf-ins:#1f4f8f;--atf-del:#b42318;--atf-move:#16a34a;}',
    'html,body{margin:0;padding:0;overflow:hidden;}',
    'body{font-family:ui-sans-serif,system-ui,sans-serif;padding:12px;color:var(--atf-text);line-height:1.45;box-sizing:border-box;}',
    'p{margin:8px 0;}',
    'code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}',
    'pre{background:var(--atf-bg-code);padding:12px;border-radius:8px;white-space:pre-wrap;overflow-x:auto;overflow-y:hidden;}',
    'pre code{white-space:pre-wrap !important;overflow-wrap:break-word;word-break:normal;}',
    '.panel{border:1px solid var(--atf-border);border-radius:8px;padding:8px;background:var(--atf-bg-panel);}',
    '.doc-line{font-family:Georgia,"Times New Roman",serif;font-size:17px;line-height:1.6;padding:8px 10px;border:1px solid var(--atf-border);border-radius:6px;background:#fff;white-space:pre-line;}',
    '.doc-ins{color:var(--atf-ins);text-decoration:underline;text-underline-offset:2px;}',
    '.doc-del{color:var(--atf-del);text-decoration:line-through;text-decoration-thickness:1.5px;}',
    '.xml-source .token.tag,.xml-source .token.punctuation{color:#0c5a41;}',
    '.xml-source .token.attr-name{color:#4b5565;}',
    '.xml-source .token.attr-value,.xml-source .token.attr-value .token.punctuation{color:#7a2ce8;}',
    '.json-source .token.property{color:#0c5a41;}',
    '.json-source .token.string{color:#7a2ce8;}',
    '.json-source .token.number{color:#b35309;}',
    '.json-source .token.boolean,.json-source .token.null{color:#4b5565;font-weight:600;}',
    '.json-source .token.operator,.json-source .token.punctuation{color:var(--atf-text-muted);}',
    '.doc-panel{border:1px solid var(--atf-border);border-radius:8px;padding:12px;background:var(--atf-bg-panel);}',
    '.doc-title{margin:0 0 10px 0;font-size:14px;font-weight:600;color:var(--atf-text-heading);}',
    '.doc-text{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:16px;line-height:1.6;white-space:pre-wrap;}',
    '.docx-table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;margin:8px 0;}',
    '.docx-table th,.docx-table td{border:1px solid var(--atf-border);padding:6px 8px;text-align:left;vertical-align:top;}',
    '.docx-table th{background:var(--atf-bg-code);font-weight:600;color:var(--atf-text-heading);}',
    '.docx-table .docx-stage-header{background:none;font-weight:600;color:var(--atf-text-heading);border-bottom:2px solid var(--atf-border);}',
    extraStyles,
    '</style></head><body>',
    `<div id="allure-auto-size-root">${body}</div>`,
    '</body></html>',
  ].join('');
}

export function buildWordLikePreviewHtml(preview) {
  const baseText = escapeForHtml(preview?.baseText ?? '');
  const insertedText = typeof preview?.insertedText === 'string'
    ? `<span class="doc-ins"> ${escapeForHtml(preview.insertedText)}</span>`
    : '';
  const deletedText = typeof preview?.deletedText === 'string'
    ? `<span class="doc-del"> ${escapeForHtml(preview.deletedText)}</span>`
    : '';
  const insertionAuthor = typeof preview?.insertedAuthor === 'string'
    ? `Insertion author: <code>${escapeForHtml(preview.insertedAuthor)}</code>`
    : '';
  const deletionAuthor = typeof preview?.deletedAuthor === 'string'
    ? `Deletion author: <code>${escapeForHtml(preview.deletedAuthor)}</code>`
    : '';
  const authorLine = [insertionAuthor, deletionAuthor].filter(Boolean).join(' | ');

  return buildHtmlAttachment([
    '<section class="panel">',
    `<p class="doc-line">${baseText}${insertedText}${deletedText}</p>`,
    authorLine.length > 0 ? `<p>${authorLine}</p>` : '',
    '</section>',
  ].join(''));
}

const DOC_PREVIEW_EXTRA_STYLES = [
  '.doc-move-from{color:var(--atf-move);text-decoration:line-through;text-decoration-style:double;text-decoration-thickness:1.5px;}',
  '.doc-move-to{color:var(--atf-move);text-decoration:underline;text-decoration-style:double;text-underline-offset:2px;}',
  '.doc-footnote-sep{border:none;border-top:1px solid var(--atf-border);margin:12px 0 6px;}',
  '.doc-footnote{font-family:Georgia,"Times New Roman",serif;font-size:13px;line-height:1.5;color:#4b5565;margin:4px 0 4px 6px;}',
  '.doc-preview-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--atf-text-muted);margin:0 0 6px;}',
].join('');

const DOC_REVISION_CLASS_MAP = {
  'insertion': 'doc-ins',
  'deletion': 'doc-del',
  'move-from': 'doc-move-from',
  'move-to': 'doc-move-to',
};

export function buildDocPreviewHtml(options) {
  const runs = options?.runs ?? [];
  const footnotes = options?.footnotes ?? [];
  const label = options?.label;

  const bodyParts = ['<section class="panel">'];

  if (typeof label === 'string' && label.length > 0) {
    bodyParts.push(`<p class="doc-preview-label">${escapeForHtml(label)}</p>`);
  }

  const lineParts = [];
  for (const run of runs) {
    if (!run.text && run.text !== '') continue;
    if (run.text.length === 0) continue;

    let content = escapeForHtml(run.text);

    if (run.script === 'subscript') {
      content = `<sub>${content}</sub>`;
    } else if (run.script === 'superscript') {
      content = `<sup>${content}</sup>`;
    }

    if (run.underline) {
      content = `<u>${content}</u>`;
    }
    if (run.italic) {
      content = `<i>${content}</i>`;
    }
    if (run.bold) {
      content = `<b>${content}</b>`;
    }

    const needsSpan = run.revision || (typeof run.positionHpt === 'number' && run.positionHpt !== 0);
    if (needsSpan) {
      const classes = run.revision ? DOC_REVISION_CLASS_MAP[run.revision] : '';
      const posStyle = typeof run.positionHpt === 'number' && run.positionHpt !== 0
        ? `position:relative;top:${-(run.positionHpt / 2)}pt`
        : '';
      const title = run.revision && typeof run.revisionAuthor === 'string' && run.revisionAuthor.length > 0
        ? ` title="${escapeForHtml(run.revisionAuthor)}"`
        : '';
      const classAttr = classes ? ` class="${classes}"` : '';
      const styleAttr = posStyle ? ` style="${posStyle}"` : '';
      content = `<span${classAttr}${styleAttr}${title}>${content}</span>`;
    }

    lineParts.push(content);
  }

  if (lineParts.length > 0) {
    bodyParts.push(`<p class="doc-line">${lineParts.join('')}</p>`);
  }

  if (footnotes.length > 0) {
    bodyParts.push('<hr class="doc-footnote-sep">');
    for (const fn of footnotes) {
      const marker = escapeForHtml(fn.marker);
      const text = escapeForHtml(fn.text);
      bodyParts.push(`<p class="doc-footnote"><sup>${marker}</sup> ${text}</p>`);
    }
  }

  bodyParts.push('</section>');

  return buildHtmlAttachment(bodyParts.join(''), DOC_PREVIEW_EXTRA_STYLES);
}

export function buildPrettyXmlHtml(xml) {
  const prettyXml = formatXmlForDisplay(xml);
  const highlighted = highlightXmlForHtml(prettyXml);
  return buildHtmlAttachment([
    '<pre><code class="xml-source">',
    highlighted,
    '</code></pre>',
  ].join(''));
}

export function buildPrettyJsonHtml(payload) {
  const prettyJson = JSON.stringify(payload, null, 2);
  if (prettyJson.length > PRISM_JSON_SIZE_LIMIT) {
    return buildHtmlAttachment([
      '<pre><code class="json-source">',
      escapeForHtml(prettyJson),
      '</code></pre>',
    ].join(''));
  }
  const highlighted = highlightJsonForHtml(prettyJson);
  return buildHtmlAttachment([
    '<pre><code class="json-source">',
    highlighted,
    '</code></pre>',
  ].join(''));
}

export function buildWordLikeTextHtml(content, title) {
  return buildHtmlAttachment([
    '<section class="doc-panel">',
    title ? `<h2 class="doc-title">${escapeForHtml(title)}</h2>` : '',
    `<p class="doc-text">${escapeForHtml(content)}</p>`,
    '</section>',
  ].join(''));
}

// ── Standalone convenience functions ────────────────────────────────────────

export async function allureSeverity(level) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.severity === 'function') {
    await runtime.severity(level);
  }
}

export async function allureDescription(content) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.description === 'function') {
    await runtime.description(content);
  }
}

export async function allureDescriptionHtml(content) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.descriptionHtml === 'function') {
    await runtime.descriptionHtml(content);
    return;
  }
  await allureDescription(content);
}

export async function allureMarkdownAttachment(name, content) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.attachment === 'function') {
    await runtime.attachment(name, content, MARKDOWN_CONTENT_TYPE);
  }
}

export async function allurePrettyJsonAttachment(name, payload) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.attachment === 'function') {
    await runtime.attachment(name, buildPrettyJsonHtml(payload), HTML_CONTENT_TYPE);
  }
}

export async function allureWordLikeTextAttachment(name, content, options) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.attachment === 'function') {
    await runtime.attachment(name, buildWordLikeTextHtml(content, options?.title), HTML_CONTENT_TYPE);
  }
}

export function buildWordLikeMarkdownHtml(markdown, title) {
  const escaped = escapeForHtml(markdown);
  return buildHtmlAttachment([
    '<section class="doc-panel">',
    title ? `<h2 class="doc-title">${escapeForHtml(title)}</h2>` : '',
    `<pre class="doc-text" style="white-space:pre-wrap;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;">${escaped}</pre>`,
    '</section>',
  ].join(''));
}

export function buildWordLikeMarkdownDiffHtml(before, after, title) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const diffParts = [];
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLen; i++) {
    const bLine = i < beforeLines.length ? beforeLines[i] : undefined;
    const aLine = i < afterLines.length ? afterLines[i] : undefined;

    if (bLine === aLine) {
      diffParts.push(escapeForHtml(aLine));
    } else if (bLine !== undefined && aLine !== undefined) {
      diffParts.push(`<span class="doc-del">${escapeForHtml(bLine)}</span>`);
      diffParts.push(`<span class="doc-ins">${escapeForHtml(aLine)}</span>`);
    } else if (bLine !== undefined) {
      diffParts.push(`<span class="doc-del">${escapeForHtml(bLine)}</span>`);
    } else {
      diffParts.push(`<span class="doc-ins">${escapeForHtml(aLine)}</span>`);
    }
  }

  return buildHtmlAttachment([
    '<section class="doc-panel">',
    title ? `<h2 class="doc-title">${escapeForHtml(title)}</h2>` : '',
    `<pre class="doc-text" style="white-space:pre-wrap;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;">${diffParts.join('\n')}</pre>`,
    '</section>',
  ].join(''));
}

export async function allureWordLikeMarkdownAttachment(name, markdown, options) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.attachment === 'function') {
    await runtime.attachment(name, buildWordLikeMarkdownHtml(markdown, options?.title), HTML_CONTENT_TYPE);
  }
}

export async function allureWordLikeMarkdownDiffAttachment(name, before, after, options) {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.attachment === 'function') {
    await runtime.attachment(name, buildWordLikeMarkdownDiffHtml(before, after, options?.title), HTML_CONTENT_TYPE);
  }
}

export async function allureFileAttachment(name, filePath, contentType = 'application/octet-stream') {
  const runtime = getAllureRuntime();
  if (runtime && typeof runtime.attachment === 'function') {
    const bytes = readFileSync(filePath);
    await runtime.attachment(name, bytes, contentType);
  }
}

export async function allureImageAttachment(name, filePath, contentType = 'image/png') {
  await allureFileAttachment(name, filePath, contentType);
}

// ── Internal utilities ──────────────────────────────────────────────────────

function valueToString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

function parseCurrentTestName() {
  const state = expect.getState();
  return (state.currentTestName ?? '')
    .split(' > ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function computeTestKey() {
  const state = expect.getState();
  return `${state.testPath ?? ''}::${state.currentTestName ?? ''}`;
}

function normalizeOpenSpecScenarioIds(values) {
  const flattened = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
  const ids = flattened
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(ids)];
}

function normalizeScenarioText(story) {
  const withoutPrefix = story.replace(/^Scenario:\s*/i, '').trim();
  return withoutPrefix.replace(/^\[[^\]]+\]\s*/, '').trim();
}

function normalizeTags(values) {
  const normalized = (values ?? [])
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
}

const ALLURE_FEATURE_ACRONYMS = new Set([
  'AI', 'API', 'AST', 'CLI', 'DOCX', 'ID', 'JSON', 'MCP', 'MCPB',
  'OOXML', 'SDK', 'UI', 'WML', 'XML',
]);

function normalizeFeatureLabel(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw.length === 0) {
    return 'General';
  }
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)+$/i.test(raw)) {
    return raw;
  }
  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => {
      const upper = segment.toUpperCase();
      if (ALLURE_FEATURE_ACRONYMS.has(upper)) {
        return upper;
      }
      if (/^\d+$/.test(segment)) {
        return segment;
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(' ');
}

function mergeAllureDefaults(current, next) {
  const merged = { ...(current ?? {}), ...(next ?? {}) };

  if (current?.openspecScenarioIds || next?.openspecScenarioIds) {
    merged.openspecScenarioIds = normalizeOpenSpecScenarioIds([
      ...(current?.openspecScenarioIds ?? []),
      ...(next?.openspecScenarioIds ?? []),
    ]);
  }

  if (current?.tags || next?.tags) {
    merged.tags = normalizeTags([
      ...(current?.tags ?? []),
      ...(next?.tags ?? []),
    ]);
  }

  if (current?.parameters || next?.parameters) {
    merged.parameters = {
      ...(current?.parameters ?? {}),
      ...(next?.parameters ?? {}),
    };
  }

  return merged;
}

function resolveStoryLabel(explicitName, nameParts) {
  if (
    typeof explicitName === 'string'
    && explicitName.trim().length > 0
    && !/%[sdifjoO]/.test(explicitName)
  ) {
    return explicitName;
  }
  return nameParts.at(-1) ?? 'Unnamed test';
}

function extractScenarioId(story) {
  const trimmed = story.trim();
  const bracketed = trimmed.match(/^\[([^\]]+)\]/);
  if (bracketed) {
    return bracketed[1].trim();
  }
  return null;
}

function normalizeOpenSpecScenarioKey(value) {
  return normalizeScenarioText(String(value))
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function markdownHeadingToAnchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createAllureTestHelpers(config) {
  const resolveEpic = config.resolveEpic ?? ((_feature, _fullName, defaults) => defaults?.epic ?? config.defaultEpic);

  // ── OpenSpec config ───────────────────────────────────────────────────
  const openspecConfig = config.openspec ?? {};
  const openspecEnabled = openspecConfig.enabled !== false;
  const openspecIdPattern = openspecConfig.idPattern ?? /^(?:SDX|OA)-[\w-]+-?\d+$/i;
  const openspecRepoBaseUrl = openspecConfig.repoBaseUrl ?? 'https://github.com/usejunior/safe-docx';
  const openspecSearchUrl = `${openspecRepoBaseUrl}/search`;
  const openspecRepoRoot = openspecConfig.repoRoot ?? process.cwd();
  const openspecSpecRoot = openspecConfig.specRoot ?? path.join(openspecRepoRoot, 'openspec');

  // ── OpenSpec index (lazy, per-factory instance) ───────────────────────

  function listOpenSpecFiles(rootDir) {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
      return [];
    }

    const queue = [rootDir];
    const files = [];
    while (queue.length > 0) {
      const dir = queue.pop();
      if (!dir) {
        continue;
      }
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }
        if (!entry.isFile() || entry.name !== 'spec.md') {
          continue;
        }
        const relativePath = path.relative(openspecRepoRoot, fullPath);
        if (!relativePath.includes(`${path.sep}specs${path.sep}`)) {
          continue;
        }
        files.push(fullPath);
      }
    }
    return files.sort();
  }

  let openSpecIndexCache = null;

  function buildOpenSpecIndex() {
    const scenarioNameToIds = new Map();
    const idToMeta = new Map();

    const files = listOpenSpecFiles(openspecSpecRoot);
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(openspecRepoRoot, filePath).split(path.sep).join('/');
      const scenarioHeaderRe = /^\s*####\s+Scenario:\s*(.+?)\s*$/gm;
      let match = scenarioHeaderRe.exec(content);
      while (match) {
        const rawScenario = match[1].trim();
        const normalizedScenario = normalizeScenarioText(rawScenario);
        const scenarioId = extractScenarioId(rawScenario);
        if (scenarioId) {
          const key = normalizeOpenSpecScenarioKey(normalizedScenario);
          const mappedIds = scenarioNameToIds.get(key) ?? new Set();
          mappedIds.add(scenarioId);
          scenarioNameToIds.set(key, mappedIds);

          if (!idToMeta.has(scenarioId)) {
            const heading = `Scenario: ${rawScenario}`;
            const anchor = markdownHeadingToAnchor(heading);
            idToMeta.set(scenarioId, {
              name: normalizedScenario,
              url: `${openspecRepoBaseUrl}/blob/main/${relativePath}#${anchor}`,
            });
          }
        }

        match = scenarioHeaderRe.exec(content);
      }
    }

    return { scenarioNameToIds, idToMeta };
  }

  function getOpenSpecIndex() {
    if (!openSpecIndexCache) {
      openSpecIndexCache = buildOpenSpecIndex();
    }
    return openSpecIndexCache;
  }

  function matchesOpenSpecIdPattern(value) {
    return openspecIdPattern.test(value);
  }

  function extractScenarioIdWithPattern(story) {
    const trimmed = story.trim();
    const bracketed = trimmed.match(/^\[([^\]]+)\]/);
    if (bracketed) {
      return bracketed[1].trim();
    }
    return matchesOpenSpecIdPattern(trimmed) ? trimmed : null;
  }

  function inferScenarioIdFromStory(story) {
    if (!openspecEnabled) {
      return null;
    }
    const normalized = normalizeOpenSpecScenarioKey(story);
    if (!normalized) {
      return null;
    }
    const ids = getOpenSpecIndex().scenarioNameToIds.get(normalized);
    if (!ids || ids.size !== 1) {
      return null;
    }
    return [...ids][0];
  }

  function resolveOpenSpecLink(id) {
    const indexEntry = getOpenSpecIndex().idToMeta.get(id);
    if (indexEntry) {
      return {
        name: `[${id}] ${indexEntry.name}`,
        url: indexEntry.url,
      };
    }

    return {
      name: `[${id}] OpenSpec search`,
      url: `${openspecSearchUrl}?q=${encodeURIComponent(`${id} path:openspec`)}&type=code`,
    };
  }

  // ── Allure label application ──────────────────────────────────────────

  async function applyAllureTags(allureRuntime, tags) {
    for (const tag of tags) {
      if (typeof allureRuntime.tags === 'function') {
        await allureRuntime.tags(tag);
        continue;
      }
      if (typeof allureRuntime.tag === 'function') {
        await allureRuntime.tag(tag);
        continue;
      }
      if (typeof allureRuntime.label === 'function') {
        await allureRuntime.label('tag', tag);
      }
    }
  }

  async function applyDefaultAllureLabels(defaults) {
    const allureRuntime = getAllureRuntime();
    if (!allureRuntime) {
      return;
    }

    const nameParts = parseCurrentTestName();
    const hierarchyParts = nameParts.slice(0, -1);
    const fullName = nameParts.join(' > ');
    const rawFeature = defaults?.feature ?? hierarchyParts[0] ?? nameParts[0] ?? 'General';
    const feature = normalizeFeatureLabel(rawFeature);
    const hasExplicitFeature = typeof defaults?.feature === 'string' && defaults.feature.trim().length > 0;
    const suite = defaults?.suite ?? (hasExplicitFeature ? hierarchyParts[0] : hierarchyParts[1]);
    const subSuite = defaults?.subSuite ?? (hasExplicitFeature ? hierarchyParts[1] : hierarchyParts[2]);
    const epic = resolveEpic(rawFeature, fullName, defaults);

    // Resolve parentSuite: explicit default > config.defaultParentSuite > undefined
    let parentSuite = defaults?.parentSuite;
    if (!parentSuite && config.defaultParentSuite) {
      parentSuite = config.defaultParentSuite === 'epic' ? epic : config.defaultParentSuite;
    }

    await allureRuntime.epic(epic);
    await allureRuntime.feature(feature);
    if (parentSuite) {
      await allureRuntime.parentSuite(parentSuite);
    }
    if (suite) {
      await allureRuntime.suite(suite);
    }
    if (subSuite && typeof allureRuntime.subSuite === 'function') {
      await allureRuntime.subSuite(subSuite);
    }
    if (typeof defaults?.title === 'string' && defaults.title.length > 0 && typeof allureRuntime.displayName === 'function') {
      await allureRuntime.displayName(defaults.title);
    }

    if (typeof defaults?.id === 'string' && defaults.id.length > 0) {
      if (typeof allureRuntime.id === 'function') {
        await allureRuntime.id(defaults.id);
      } else if (typeof allureRuntime.allureId === 'function') {
        await allureRuntime.allureId(defaults.id);
      }
    }

    await allureRuntime.severity(defaults?.severity ?? 'normal');

    if (typeof defaults?.description === 'string' && defaults.description.length > 0 && typeof allureRuntime.description === 'function') {
      await allureRuntime.description(defaults.description);
    }

    if (defaults?.parameters && typeof allureRuntime.parameter === 'function') {
      for (const [key, value] of Object.entries(defaults.parameters)) {
        await allureRuntime.parameter(key, valueToString(value));
      }
    }

    const tags = normalizeTags(defaults?.tags ?? []);
    if (tags.length > 0) {
      await applyAllureTags(allureRuntime, tags);
    }
  }

  // ── BDD context ───────────────────────────────────────────────────────

  function createBddContext(debugState) {
    let givenCallCount = 0;
    let whenCallCount = 0;
    let thenCallCount = 0;

    const runBddStep = async (prefix, name, run, params) => {
      const stepName = `${prefix} ${name}`.trim();
      return allureStep(stepName, async (stepContext) => {
        if (params && typeof stepContext?.parameter === 'function') {
          for (const [key, value] of Object.entries(params)) {
            await stepContext.parameter(key, valueToString(value));
          }
        }
        return run();
      });
    };

    const given = async (name, run, params) => {
      const prefix = givenCallCount === 0 ? 'GIVEN:' : 'AND:';
      givenCallCount += 1;
      return runBddStep(prefix, name, run, params);
    };

    const when = async (name, run, params) => {
      const prefix = whenCallCount === 0 ? 'WHEN:' : 'AND:';
      whenCallCount += 1;
      return runBddStep(prefix, name, run, params);
    };

    const then = async (name, run, params) => {
      const prefix = thenCallCount === 0 ? 'THEN:' : 'AND:';
      thenCallCount += 1;
      return runBddStep(prefix, name, run, params);
    };

    const and = async (name, run, params) => runBddStep('AND:', name, run, params);

    return {
      given,
      when,
      then,
      and,
      attach: (name, content, contentType = TEXT_CONTENT_TYPE) =>
        allureAttachment(name, content, contentType),
      attachText: (name, text) => allureAttachment(name, text, TEXT_CONTENT_TYPE),
      attachHtml: (name, html) => allureAttachment(name, html, HTML_CONTENT_TYPE),
      attachMarkdown: (name, markdown) => allureAttachment(name, markdown, MARKDOWN_CONTENT_TYPE),
      attachJson: (name, payload) => allureJsonAttachment(name, payload),
      attachPrettyJson: (name, payload) =>
        allureAttachment(name, buildPrettyJsonHtml(payload), HTML_CONTENT_TYPE),
      attachPrettyXml: (name, xml) =>
        allureAttachment(name, buildPrettyXmlHtml(xml), HTML_CONTENT_TYPE),
      attachWordLikePreview: (name, preview) =>
        allureAttachment(name, buildWordLikePreviewHtml(preview), HTML_CONTENT_TYPE),
      attachDocPreview: (name, options) =>
        allureAttachment(name, buildDocPreviewHtml(options), HTML_CONTENT_TYPE),
      attachXmlPreviews: async (xml, options = {}) => {
        if (options.docPreview) {
          await allureAttachment(
            options.docPreviewName ?? 'Document preview',
            buildDocPreviewHtml(options.docPreview),
            HTML_CONTENT_TYPE,
          );
        }
        if (options.wordLike) {
          await allureAttachment(
            options.wordLikeName ?? 'Word-like visual preview',
            buildWordLikePreviewHtml(options.wordLike),
            HTML_CONTENT_TYPE,
          );
        }
        await allureAttachment(
          options.xmlName ?? 'Input XML fixture (pretty XML)',
          buildPrettyXmlHtml(xml),
          HTML_CONTENT_TYPE,
        );
      },
      setDebugContext: (payload) => {
        debugState.context = payload;
      },
      setDebugResult: (payload) => {
        debugState.result = payload;
      },
      attachJsonLastStep: async (options = {}) => {
        if (Object.prototype.hasOwnProperty.call(options, 'context')) {
          debugState.context = options.context;
        }
        if (Object.prototype.hasOwnProperty.call(options, 'result')) {
          debugState.result = options.result;
        }

        const attachDebugJson = async () => {
          await allureAttachment(
            options.contextAttachmentName ?? 'Test context (debug JSON)',
            buildPrettyJsonHtml(debugState.context ?? null),
            HTML_CONTENT_TYPE,
          );
          await allureAttachment(
            options.resultAttachmentName ?? 'Final result (debug JSON)',
            buildPrettyJsonHtml(debugState.result ?? null),
            HTML_CONTENT_TYPE,
          );
        };

        if (options.attachAsStep === true) {
          await allureStep(options.stepName ?? 'Attach debug JSON (context + result)', attachDebugJson);
        } else {
          await attachDebugJson();
        }
      },
      parameter: (name, value) => allureParameter(name, valueToString(value)),
    };
  }

  // ── Core wrapper ──────────────────────────────────────────────────────

  function wrapWithAllure(fn, explicitName, defaults) {
    if (!fn) {
      return fn;
    }

    return (async (...args) => {
      const testKey = computeTestKey();

      // ── beforeTest lifecycle hook ──
      if (typeof config.beforeTest === 'function') {
        await config.beforeTest({ testKey });
      }

      const nameParts = parseCurrentTestName();
      const scenarioIds = defaults?.openspecScenarioIds ?? [];
      const baseStoryLabels = scenarioIds.length > 0
        ? scenarioIds
        : [resolveStoryLabel(explicitName, nameParts)];
      const storyLabels = baseStoryLabels.map((story) =>
        /^Scenario:\s*/i.test(story) || /^\[[^\]]+\]\s*/.test(story)
          ? normalizeScenarioText(story)
          : story,
      );
      const scenarioSerials = new Set();
      if (openspecEnabled) {
        for (const story of baseStoryLabels) {
          const id = extractScenarioIdWithPattern(story);
          if (id) scenarioSerials.add(id);
        }
        for (const story of storyLabels) {
          const inferredId = inferScenarioIdFromStory(story);
          if (inferredId) {
            scenarioSerials.add(inferredId);
          }
        }
      }

      const isScenarioStyle = baseStoryLabels.some((story) => /^Scenario:\s*/i.test(story));
      let effectiveDefaults = defaults;
      if (scenarioIds.length > 0 || isScenarioStyle) {
        const firstStory = storyLabels[0] ?? '';
        const scenarioText = normalizeScenarioText(firstStory);
        const autoDefaults = {
          description: scenarioText.length > 0
            ? [
              `This test validates the OpenSpec scenario: ${scenarioText}.`,
              'Expected outcome: implementation behavior matches this scenario.',
            ].join('\n')
            : undefined,
          tags: ['human-readable'],
          parameters: { audience: 'non-technical' },
        };
        effectiveDefaults = mergeAllureDefaults(autoDefaults, defaults);
      }

      await applyDefaultAllureLabels(effectiveDefaults);

      const allureRuntime = getAllureRuntime();
      if (allureRuntime) {
        for (const story of storyLabels) {
          await allureRuntime.story(story);
        }
        if (!defaults?.id && scenarioSerials.size === 1 && typeof allureRuntime.id === 'function') {
          await allureRuntime.id([...scenarioSerials][0]);
        }
        if (typeof allureRuntime.label === 'function') {
          for (const id of scenarioSerials) {
            await allureRuntime.label('openspecScenarioId', id);
          }
        }
        if (typeof allureRuntime.link === 'function') {
          for (const id of scenarioSerials) {
            const link = resolveOpenSpecLink(id);
            await allureRuntime.link('openspec', link.url, link.name);
          }
        }
      }

      const injectBdd = config.injectBddContext !== false;
      const callArgs = (() => {
        if (!injectBdd) {
          return args;
        }
        const debugState = { context: null, result: null };
        const bddContext = createBddContext(debugState);
        const firstArg = args[0];
        if (firstArg && typeof firstArg === 'object') {
          return [{ ...firstArg, ...bddContext }, ...args.slice(1)];
        }
        return [bddContext, ...args];
      })();

      let testError;
      try {
        const result = await fn(...callArgs);
        return result;
      } catch (error) {
        testError = error;
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        await allureAttachment('execution-error.txt', message, TEXT_CONTENT_TYPE);
      } finally {
        // ── afterTest lifecycle hook ──
        if (typeof config.afterTest === 'function') {
          try {
            await config.afterTest({
              testKey,
              error: testError,
              passed: !testError,
              helpers: { allureAttachment, allureJsonAttachment },
            });
          } catch (hookError) {
            try {
              const msg = hookError instanceof Error ? hookError.message : String(hookError);
              await allureAttachment('afterTest-hook-failure.txt', msg, TEXT_CONTENT_TYPE);
            } catch {
              // Best-effort; don't mask original error
            }
          }
        }
        if (testError) {
          throw testError;
        }
      }
    });
  }

  // ── withAllure chain builder ──────────────────────────────────────────

  function withAllure(base, defaults) {
    const wrapped = ((name, fn, timeout) =>
      base(name, wrapWithAllure(fn, name, defaults), timeout));

    wrapped.only = (name, fn, timeout) =>
      base.only(name, wrapWithAllure(fn, name, defaults), timeout);
    wrapped.skip = base.skip.bind(base);
    wrapped.todo = base.todo.bind(base);
    wrapped.fails = (name, fn, timeout) =>
      base.fails(name, wrapWithAllure(fn, name, defaults), timeout);
    wrapped.concurrent = (name, fn, timeout) =>
      base.concurrent(name, wrapWithAllure(fn, name, defaults), timeout);

    wrapped.each = (...tableArgs) => {
      const eachBase = base.each(...tableArgs);
      return (name, fn, timeout) =>
        eachBase(name, wrapWithAllure(fn, name, defaults), timeout);
    };

    wrapped.withLabels = (nextDefaults) =>
      withAllure(base, mergeAllureDefaults(defaults, nextDefaults));
    wrapped.epic = (epic) =>
      withAllure(base, mergeAllureDefaults(defaults, { epic }));
    wrapped.openspec = (...scenarioIds) =>
      withAllure(base, mergeAllureDefaults(defaults, {
        openspecScenarioIds: normalizeOpenSpecScenarioIds(scenarioIds),
      }));
    wrapped.allure = (metadata) =>
      withAllure(base, mergeAllureDefaults(defaults, metadata));

    return wrapped;
  }

  // ── Factory-scoped Allure helpers ─────────────────────────────────────

  const itAllure = withAllure(vitestIt);
  const testAllure = withAllure(vitestTest);

  async function allureStep(name, run) {
    const allureRuntime = getAllureRuntime();
    if (allureRuntime) {
      return allureRuntime.step(name, run);
    }
    return run();
  }

  async function allureParameter(name, value) {
    const allureRuntime = getAllureRuntime();
    if (allureRuntime && typeof allureRuntime.parameter === 'function') {
      await allureRuntime.parameter(name, value);
    }
  }

  async function allureAttachment(name, content, contentType = TEXT_CONTENT_TYPE) {
    const allureRuntime = getAllureRuntime();
    if (allureRuntime && typeof allureRuntime.attachment === 'function') {
      await allureRuntime.attachment(name, content, contentType);
    }
  }

  async function allureJsonAttachment(name, payload) {
    const body = JSON.stringify(payload, null, 2);
    await allureAttachment(name, body, JSON_CONTENT_TYPE);
  }

  return {
    itAllure,
    testAllure,
    allureStep,
    allureParameter,
    allureAttachment,
    allureJsonAttachment,
    getAllureRuntime,
  };
}

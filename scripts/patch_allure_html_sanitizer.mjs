#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_REPORT_DIR = 'allure-report';
const DEFAULT_SANITIZER_CALL = 'sanitize(e,void 0)';
const SANITIZER_ALLOWLIST_CALL =
  'sanitize(e,{WHOLE_DOCUMENT:!0,USE_PROFILES:{html:!0},ADD_TAGS:["html","head","body","style"],ADD_ATTR:["class"],FORBID_TAGS:["script","iframe","object","embed","form","input","button","textarea","select","option","meta","base","link"]})';

const HTML_PREVIEW_NEEDLES = [
  {
    needle: 'children:B2(Sw,{item:e,i18n:{imageDiff:e=>i(`imageDiff.${e}`)}})',
    replacement:
      'children:B2(Sw,{item:e,previewable:"html"===s||"svg"===s||"image"===s,i18n:{imageDiff:e=>i(`imageDiff.${e}`)}})',
  },
  {
    needle: 'component:B2(Sw,{item:e,i18n:{imageDiff:e=>r(`imageDiff.${e}`)}})',
    replacement:
      'component:B2(Sw,{item:e,previewable:"html"===Wd(a)||"svg"===Wd(a)||"image"===Wd(a),i18n:{imageDiff:e=>r(`imageDiff.${e}`)}})',
  },
];

const UX_BLOCK_START = '<!-- oa-allure-html-ux:start -->';
const UX_BLOCK_END = '<!-- oa-allure-html-ux:end -->';

function stripManagedBlock(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start === -1) return content;
  const end = content.indexOf(endMarker, start);
  if (end === -1) return content;
  const removeTo = end + endMarker.length;
  return `${content.slice(0, start)}${content.slice(removeTo)}`;
}

function buildUxBlock() {
  const style = [
    '[data-testid="test-result-attachment"] [class*="html-attachment-preview"] {',
    '  min-height: 0 !important;',
    '  max-height: 72vh !important;',
    '  overflow-x: hidden !important;',
    '  overflow-y: hidden !important;',
    '}',
    '[data-testid="test-result-attachment"] [class*="html-attachment-preview"] iframe {',
    '  width: 100% !important;',
    '  min-height: 0 !important;',
    '  border: 0 !important;',
    '}',
    '[role="dialog"] [data-testid="test-result-attachment"] [class*="html-attachment-preview"],',
    '[role="dialog"] [class*="html-attachment-preview"] {',
    '  min-height: 0 !important;',
    '  max-height: 90vh !important;',
    '}',
    '[role="dialog"] [data-testid="test-result-attachment"] [class*="html-attachment-preview"] iframe,',
    '[role="dialog"] [class*="html-attachment-preview"] iframe {',
    '  min-height: 0 !important;',
    '}',
    '[data-testid="test-result-attachment"] .Yino1buJ,',
    '[data-testid="test-result-attachment"] .Px8Q9Npk {',
    '  overflow: visible !important;',
    '}',
  ].join('\n');

  const runtime = [
    '(() => {',
    '  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));',
    '  const resizeFrame = (frame) => {',
    '    try {',
    '      const doc = frame.contentDocument;',
    '      if (!doc) return;',
    '      const inDialog = !!frame.closest(\'[role="dialog"]\');',
    '      const min = 0;',
    '      const max = inDialog',
    '        ? Math.max(420, Math.floor(window.innerHeight * 0.9))',
    '        : Math.max(220, Math.floor(window.innerHeight * 0.72));',
    '      const root = doc.getElementById(\'allure-auto-size-root\');',
    '      const rootHeight = root ? Math.ceil(root.getBoundingClientRect().height) : 0;',
    '      const bodyHeight = doc.body ? doc.body.scrollHeight : 0;',
    '      const contentHeight = Math.max(rootHeight, bodyHeight, 0);',
    '      if (contentHeight <= 0) return;',
    '      const contentTarget = Math.max(min, contentHeight + 8);',
    '      const previewTarget = clamp(contentTarget, min, max);',
    '      const overflowNeeded = contentTarget > max;',
    '      const preview = frame.closest(\'[class*="html-attachment-preview"]\');',
    '      if (preview) {',
    '        preview.style.height = String(previewTarget) + \'px\';',
    '        preview.style.minHeight = \'0px\';',
    '        preview.style.maxHeight = String(max) + \'px\';',
    '        preview.style.setProperty(\'overflow-y\', overflowNeeded ? \'auto\' : \'hidden\', \'important\');',
    '        preview.style.setProperty(\'overflow-x\', \'hidden\', \'important\');',
    '      }',
    '      frame.setAttribute(\'scrolling\', \'no\');',
    '      frame.style.height = String(contentTarget) + \'px\';',
    '      frame.style.minHeight = \'0px\';',
    '      frame.style.overflow = \'hidden\';',
    '    } catch {',
    '      // Ignore transient/cross-origin iframe failures.',
    '    }',
    '  };',
    '  const autoSizeHtmlAttachmentFrames = () => {',
    '    document',
    '      .querySelectorAll(\'[data-testid="test-result-attachment"] [class*="html-attachment-preview"] iframe\')',
    '      .forEach((frame) => {',
    '        if (frame.dataset.oaAutoSizedAttached !== "1") {',
    '          frame.addEventListener(\'load\', () => resizeFrame(frame));',
    '          frame.dataset.oaAutoSizedAttached = "1";',
    '        }',
    '        resizeFrame(frame);',
    '      });',
    '  };',
    '  const run = () => autoSizeHtmlAttachmentFrames();',
    '  const observer = new MutationObserver(() => run());',
    '  observer.observe(document.documentElement, { childList: true, subtree: true });',
    '  window.addEventListener(\'resize\', run);',
    '  if (document.readyState === \'loading\') {',
    '    document.addEventListener(\'DOMContentLoaded\', run);',
    '  } else {',
    '    run();',
    '  }',
    '})();',
  ].join('\n');

  return [
    UX_BLOCK_START,
    '<style>',
    style,
    '</style>',
    '<script>',
    runtime,
    '</script>',
    UX_BLOCK_END,
  ].join('\n');
}

function parseArgs(argv) {
  const parsed = { reportDir: DEFAULT_REPORT_DIR };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report-dir' && argv[i + 1]) {
      parsed.reportDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--report-dir=')) {
      parsed.reportDir = arg.slice('--report-dir='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function patchFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let patched = raw;

  let sanitizerReplacements = 0;
  const sanitizerMatches = patched.split(DEFAULT_SANITIZER_CALL).length - 1;
  if (sanitizerMatches > 0) {
    patched = patched.replaceAll(DEFAULT_SANITIZER_CALL, SANITIZER_ALLOWLIST_CALL);
    sanitizerReplacements = sanitizerMatches;
  }

  let previewReplacements = 0;
  for (const patch of HTML_PREVIEW_NEEDLES) {
    const matches = patched.split(patch.needle).length - 1;
    if (matches > 0) {
      patched = patched.replaceAll(patch.needle, patch.replacement);
      previewReplacements += matches;
    }
  }

  if (patched === raw) {
    return { updated: false, sanitizerReplacements: 0, previewReplacements: 0 };
  }

  fs.writeFileSync(filePath, patched, 'utf8');
  return { updated: true, sanitizerReplacements, previewReplacements };
}

function patchReportIndex(reportPath) {
  const indexPath = path.join(reportPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing report index: ${indexPath}`);
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  html = stripManagedBlock(html, UX_BLOCK_START, UX_BLOCK_END);
  if (!html.includes('</head>')) {
    throw new Error(`Invalid report index (missing </head>): ${indexPath}`);
  }
  html = html.replace('</head>', `${buildUxBlock()}\n</head>`);
  fs.writeFileSync(indexPath, html, 'utf8');
}

function main() {
  const { reportDir } = parseArgs(process.argv.slice(2));
  const reportPath = path.resolve(process.cwd(), reportDir);
  if (!fs.existsSync(reportPath) || !fs.statSync(reportPath).isDirectory()) {
    throw new Error(`Allure report directory not found: ${reportPath}`);
  }

  const appFiles = fs.readdirSync(reportPath).filter((name) => /^app-.*\.js$/.test(name));
  if (appFiles.length === 0) {
    throw new Error(`No app-*.js files found in ${reportPath}`);
  }

  let updatedFiles = 0;
  let sanitizerReplacementCount = 0;
  let previewReplacementCount = 0;

  for (const name of appFiles) {
    const filePath = path.join(reportPath, name);
    const result = patchFile(filePath);
    if (result.updated) {
      updatedFiles += 1;
      sanitizerReplacementCount += result.sanitizerReplacements;
      previewReplacementCount += result.previewReplacements;
    }
  }

  if (updatedFiles === 0) {
    console.warn(`No known HTML preview/sanitizer patch points found in ${reportDir}/app-*.js.`);
  } else {
    console.log(
      `Patched ${updatedFiles} app bundle file(s) in ${reportDir}: ` +
        `${sanitizerReplacementCount} sanitizer replacement(s), ` +
        `${previewReplacementCount} html-preview replacement(s).`,
    );
  }

  patchReportIndex(reportPath);
  console.log(`Patched HTML preview UX block in ${reportDir}/index.html.`);
}

main();

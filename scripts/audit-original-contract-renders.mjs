#!/usr/bin/env node

/**
 * Render-audit the baseline declarative DOCX for each verified original.
 *
 * This is deliberately a rendering audit, not a second substantive contract
 * verifier. LibreOffice generates the PDFs; Poppler supplies extracted text
 * and word boxes. Bounds and possible word-box collisions are automated
 * signals only. They cannot prove that there is no visual overlap.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { resolveLibreOfficeBinary } from './libreoffice_headless.mjs';
import { receiptMatches } from './export-original-contracts.mjs';
import { decodeXmlText } from './lib/xml-text.mjs';
import { compileOriginalContract } from '../dist/core/original-contract.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const EVIDENCE = join(ROOT, '.cache', 'original-contracts');
const DEFAULT_OUTPUT = join(EVIDENCE, 'render-audit-20260917');
const EXPORT_CATALOG = join(EVIDENCE, 'export', 'catalog.json');
const BASELINE = join('cases', 'baseline.declarative.docx');

function usage() {
  return [
    'Usage: node scripts/audit-original-contract-renders.mjs [--template <id>] [--output <dir>]',
    '',
    'Without --template, requires current hash-bound verification receipts and a',
    'matching verified-only exported catalog for every current original template.',
  ].join('\n');
}

function parseArgs(args) {
  const result = { output: DEFAULT_OUTPUT, template: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--output' && args[index + 1]) result.output = resolve(args[++index]);
    else if (arg === '--template' && args[index + 1]) result.template = args[++index];
    else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return result;
}

function command(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? `exit ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed: ${detail}`);
  }
  return result.stdout;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function currentOriginals() {
  const groups = ['openagreements-cc-by-4.0', 'openagreements-cc0-1.0'];
  return groups.flatMap((group) => readdirSync(join(ROOT, 'templates', group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ id: entry.name, templateDir: join(ROOT, 'templates', group, entry.name) })))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function assertCurrentEvidence(originals) {
  if (!existsSync(EXPORT_CATALOG)) throw new Error(`Verified-only export catalog is missing: ${EXPORT_CATALOG}`);
  const catalogBytes = readFileSync(EXPORT_CATALOG);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const expectedIds = originals.map((item) => item.id);
  const entryById = new Map((catalog.entries ?? []).map((entry) => [entry.template_id, entry]));
  const catalogIds = [...entryById.keys()].sort();
  if (catalog.verified_only !== true || catalog.summary?.discovered !== expectedIds.length
    || catalog.summary?.verified !== expectedIds.length || catalog.summary?.compiled_unverified !== 0
    || catalog.summary?.blocked !== 0 || JSON.stringify(catalogIds) !== JSON.stringify(expectedIds)) {
    throw new Error('Exported verified-only catalog does not match the current originals inventory.');
  }

  const failures = [];
  for (const { id, templateDir } of originals) {
    const receiptPath = join(EVIDENCE, id, 'receipt.json');
    const baseline = join(EVIDENCE, id, BASELINE);
    if (!existsSync(receiptPath) || !existsSync(baseline)) {
      failures.push(`${id}: missing receipt or baseline declarative DOCX`);
      continue;
    }
    const contract = await compileOriginalContract(templateDir);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const entry = entryById.get(id);
    if (!receiptMatches(contract, receipt, templateDir)
      || entry?.status !== 'verified'
      || entry.contract_sha256 !== receipt.compiled_contract_sha256) {
      failures.push(`${id}: stale or mismatched receipt/catalog contract digest`);
    }
  }
  if (failures.length) throw new Error(`Current verification evidence is not valid:\n${failures.join('\n')}`);
  return {
    catalog: EXPORT_CATALOG,
    catalog_sha256: sha256(catalogBytes),
    verified_receipts: originals.length,
  };
}

function attrs(fragment) {
  return Object.fromEntries([...fragment.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
}

function parseBbox(xml) {
  const pages = [];
  for (const match of xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    const pageAttrs = attrs(match[1]);
    const width = Number(pageAttrs.width);
    const height = Number(pageAttrs.height);
    const words = [...match[2].matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)].map((word) => {
      const wordAttrs = attrs(word[1]);
      return {
        text: decodeXmlText(word[2]),
        x_min: Number(wordAttrs.xMin),
        y_min: Number(wordAttrs.yMin),
        x_max: Number(wordAttrs.xMax),
        y_max: Number(wordAttrs.yMax),
      };
    });
    pages.push({ width, height, words });
  }
  return pages;
}

function overlap(left, right) {
  const horizontal = Math.max(0, Math.min(left.x_max, right.x_max) - Math.max(left.x_min, right.x_min));
  const vertical = Math.max(0, Math.min(left.y_max, right.y_max) - Math.max(left.y_min, right.y_min));
  const intersection = horizontal * vertical;
  const leftArea = Math.max(0, left.x_max - left.x_min) * Math.max(0, left.y_max - left.y_min);
  const rightArea = Math.max(0, right.x_max - right.x_min) * Math.max(0, right.y_max - right.y_min);
  return intersection > 0 && intersection / Math.min(leftArea, rightArea) >= 0.8;
}

function geometry(pages) {
  const out_of_bounds = [];
  const potential_overlaps = [];
  let word_count = 0;
  pages.forEach((page, pageIndex) => {
    const epsilon = 0.5;
    page.words.forEach((word, wordIndex) => {
      word_count += 1;
      if (![page.width, page.height, word.x_min, word.y_min, word.x_max, word.y_max].every(Number.isFinite)
        || word.x_min < -epsilon || word.y_min < -epsilon
        || word.x_max > page.width + epsilon || word.y_max > page.height + epsilon
        || word.x_max <= word.x_min || word.y_max <= word.y_min) {
        out_of_bounds.push({ page: pageIndex + 1, word_index: wordIndex, ...word });
      }
    });
    // This flags only nearly complete box containment/intersection, which is a
    // useful automated signal. It is not a claim that all visual overlap is absent.
    for (let left = 0; left < page.words.length; left += 1) {
      for (let right = left + 1; right < page.words.length; right += 1) {
        if (overlap(page.words[left], page.words[right])) {
          potential_overlaps.push({ page: pageIndex + 1, left: page.words[left], right: page.words[right] });
        }
      }
    }
  });
  return { page_count: pages.length, word_count, out_of_bounds, potential_overlaps };
}

function extractText(pdf) {
  return command('pdftotext', ['-layout', pdf, '-']).replace(/\r\n/g, '\n');
}

function normalizePdfText(value) {
  return value
    .replace(/[\u00ad\u200b]/g, '')
    // Keep a visible line-wrap hyphen attached to its lower-case continuation.
    // This preserves source compounds such as "Alabama-specific" across PDF
    // extraction line wraps without changing ordinary in-line hyphens.
    .replace(/-\s+([a-z])/g, '-$1')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceExpectations(templateDir) {
  const source = readFileSync(join(templateDir, 'template.mdoc'), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new Error(`Canonical source has no frontmatter: ${templateDir}`);
  const front = yaml.load(match[1]);
  const document = front?.document;
  if (!document || typeof document !== 'object' || typeof document.title !== 'string') {
    throw new Error(`Canonical source has no document.title: ${templateDir}`);
  }
  const label = typeof document.label === 'string' ? document.label : document.title;
  const version = document.version ? ` (v${document.version})` : '';
  const provenance = front.attribution_text ?? document.license;
  return {
    canonical_title: document.title,
    canonical_footer: `${label}${version}${provenance ? `. ${String(provenance)}` : ''}`,
  };
}

function render(input, outputDir, soffice) {
  const profile = mkdtempSync(join(tmpdir(), 'oa-render-audit-soffice-'));
  try {
    command(soffice.command, [
      `-env:UserInstallation=${pathToFileURL(profile).href}`,
      '--headless', '--invisible', '--nodefault', '--nolockcheck', '--nologo', '--norestore',
      '--convert-to', 'pdf:writer_pdf_Export', '--outdir', outputDir, input,
    ], { env: { ...process.env, SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN ?? 'svp' } });
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  const pdf = join(outputDir, `${basename(input, '.docx')}.pdf`);
  statSync(pdf);
  return pdf;
}

function auditOne(id, output, soffice) {
  const input = join(EVIDENCE, id, BASELINE);
  const template = currentOriginals().find((item) => item.id === id)?.templateDir;
  if (!template) throw new Error(`Current original template is missing: ${id}`);
  const dir = join(output, id);
  mkdirSync(dir, { recursive: true });
  const pdf = render(input, dir, soffice);
  const text = extractText(pdf);
  const bbox = command('pdftotext', ['-bbox-layout', pdf, '-']);
  const pageInfo = command('pdfinfo', [pdf]);
  const parsed = parseBbox(bbox);
  const automated_geometry = geometry(parsed);
  const nonblank = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const expected = sourceExpectations(template);
  const normalizedText = normalizePdfText(text);
  const findings = {
    title_present: normalizedText.includes(normalizePdfText(expected.canonical_title)),
    footer_present: normalizedText.includes(normalizePdfText(expected.canonical_footer)),
    extracted_first_nonblank_line: nonblank.at(0) ?? '',
    extracted_last_nonblank_line: nonblank.at(-1) ?? '',
  };
  const raw = {
    profile: 'oa-original-render-raw-v1', template_id: id, input_docx: input,
    input_sha256: sha256(readFileSync(input)), pdf, pdf_sha256: sha256(readFileSync(pdf)),
    source_expectations: expected, findings,
    pdftotext_layout: text, pdftotext_bbox_layout: bbox, pdfinfo: pageInfo,
  };
  writeFileSync(join(dir, 'raw.json'), `${JSON.stringify(raw, null, 2)}\n`);
  return {
    template_id: id,
    input_docx: input,
    pdf,
    page_count: automated_geometry.page_count,
    source_expectations: expected,
    extracted_text: findings,
    automated_geometry,
    // Visual sampling is intentionally reported separately. This script does
    // not manufacture a no-overlap conclusion from word bounds.
    visual_sampling: { performed: false, conclusion: 'Not assessed by automated bbox analysis.' },
    status: automated_geometry.out_of_bounds.length === 0 && findings.title_present && findings.footer_present
      ? 'passed'
      : 'failed',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const originals = currentOriginals();
  const final_run = options.template ? null : await assertCurrentEvidence(originals);
  const ids = options.template ? [options.template] : originals.map((item) => item.id);
  if (ids.length === 0) throw new Error('No baseline declarative DOCX evidence found.');
  if (options.template && !existsSync(join(EVIDENCE, options.template, BASELINE))) {
    throw new Error(`No baseline declarative DOCX for template: ${options.template}`);
  }
  mkdirSync(options.output, { recursive: true });
  const soffice = resolveLibreOfficeBinary();
  const results = ids.map((id) => auditOne(id, options.output, soffice));
  const summary = {
    profile: 'oa-original-render-audit-v1', generated_at: new Date().toISOString(), root: ROOT,
    final_run,
    renderer: {
      libreoffice: soffice,
      soffice_binary_sha256: soffice.command.includes('/') ? sha256(readFileSync(soffice.command)) : null,
      explicit_version_override: process.env.OA_SOFFICE_PIN_VERSION ?? null,
      pdf_text: 'pdftotext -layout',
      pdf_geometry: 'pdftotext -bbox-layout',
    },
    scope: { templates: ids.length, input: 'verified baseline.declarative.docx only', sequential: true },
    limitations: [
      'Automated word bounds check only detects out-of-page words and reports potential near-complete word-box overlaps.',
      'Passing bounds do not establish absence of visual overlap; visual sampling is separately recorded.',
    ],
    totals: {
      pages: results.reduce((total, result) => total + result.page_count, 0),
      failed: results.filter((result) => result.status === 'failed').length,
      missing_titles: results.filter((result) => !result.extracted_text.title_present).length,
      missing_footers: results.filter((result) => !result.extracted_text.footer_present).length,
      potential_word_box_overlaps: results.reduce((total, result) => total + result.automated_geometry.potential_overlaps.length, 0),
    },
    results,
  };
  writeFileSync(join(options.output, 'audit.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ output: options.output, ...summary.scope, ...summary.totals }));
  if (summary.totals.failed) process.exitCode = 1;
}

await main();

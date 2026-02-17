#!/usr/bin/env node

import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

function parseArgs(argv) {
  const parsed = {
    input: null,
    outputDir: null,
    prefix: null,
    dpi: 180,
    firstPage: 1,
    lastPage: null,
    keepPdf: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') {
      parsed.input = argv[++i] ?? null;
      continue;
    }
    if (arg === '--output-dir' || arg === '-o') {
      parsed.outputDir = argv[++i] ?? null;
      continue;
    }
    if (arg === '--prefix') {
      parsed.prefix = argv[++i] ?? null;
      continue;
    }
    if (arg === '--dpi') {
      const dpi = Number(argv[++i]);
      if (!Number.isFinite(dpi) || dpi <= 0) {
        throw new Error('--dpi must be a positive number');
      }
      parsed.dpi = Math.round(dpi);
      continue;
    }
    if (arg === '--first-page') {
      const firstPage = Number(argv[++i]);
      if (!Number.isInteger(firstPage) || firstPage < 1) {
        throw new Error('--first-page must be an integer >= 1');
      }
      parsed.firstPage = firstPage;
      continue;
    }
    if (arg === '--last-page') {
      const lastPage = Number(argv[++i]);
      if (!Number.isInteger(lastPage) || lastPage < 1) {
        throw new Error('--last-page must be an integer >= 1');
      }
      parsed.lastPage = lastPage;
      continue;
    }
    if (arg === '--keep-pdf') {
      parsed.keepPdf = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.lastPage !== null && parsed.lastPage < parsed.firstPage) {
    throw new Error('--last-page must be >= --first-page');
  }

  return parsed;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/render_docx_pages.mjs --input <file.docx> [options]',
      '',
      'Converts DOCX -> PDF using LibreOffice, then PDF -> PNG pages using pdftoppm.',
      '',
      'Options:',
      '  -i, --input <path>       Input DOCX path (required)',
      '  -o, --output-dir <dir>   Output directory for PNG pages (default: <docx-dir>)',
      '      --prefix <name>      Output file prefix (default: <docx-basename>)',
      '      --dpi <n>            Rasterization DPI (default: 180)',
      '      --first-page <n>     First page to render, 1-based (default: 1)',
      '      --last-page <n>      Last page to render (default: all pages)',
      '      --keep-pdf           Keep intermediate PDF artifact',
      '      --json               Emit machine-readable JSON summary',
      '  -h, --help               Show help',
      '',
      'Environment:',
      '  SOFFICE_BIN              Optional path to soffice binary',
      '  PDFTOPPM_BIN             Optional path to pdftoppm binary',
    ].join('\n')
  );
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    ...options,
  });

  if (result.error) {
    throw new Error(`Failed to execute ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(`${command} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  return result;
}

function resolveCommand(envName, fallback) {
  const candidate = process.env[envName] || fallback;
  const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
  const fallbackProbe = probe.status === 0 ? probe : spawnSync(candidate, ['-v'], { stdio: 'ignore' });
  if (fallbackProbe.status !== 0) {
    throw new Error(`${candidate} is required but was not found. Install it or set ${envName}.`);
  }
  return candidate;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.input) {
    throw new Error('--input is required');
  }

  const inputPath = resolve(args.input);
  const ext = extname(inputPath).toLowerCase();
  if (ext !== '.docx') {
    throw new Error(`--input must be a .docx file (received: ${inputPath})`);
  }

  statSync(inputPath);

  const outputDir = resolve(args.outputDir ?? dirname(inputPath));
  mkdirSync(outputDir, { recursive: true });

  const inputBase = basename(inputPath, ext);
  const prefix = args.prefix ?? inputBase;

  const sofficeBin = resolveCommand('SOFFICE_BIN', 'soffice');
  const pdftoppmBin = resolveCommand('PDFTOPPM_BIN', 'pdftoppm');
  const renderEnv = {
    ...process.env,
    // On macOS, force a headless VCL backend to avoid AppKit/WindowServer crashes in non-GUI contexts.
    SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN ?? 'svp',
  };

  const tempDir = mkdtempSync(join(tmpdir(), 'oa-docx-render-'));
  const pdfOutDir = args.keepPdf ? outputDir : tempDir;

  runChecked(sofficeBin, [
    '--headless',
    '--invisible',
    '--nodefault',
    '--nolockcheck',
    '--nologo',
    '--norestore',
    '--convert-to',
    'pdf:writer_pdf_Export',
    '--outdir',
    pdfOutDir,
    inputPath,
  ], { env: renderEnv });

  const pdfPath = join(pdfOutDir, `${inputBase}.pdf`);
  statSync(pdfPath);

  const prefixPath = join(outputDir, prefix);
  const pdftoppmArgs = ['-png', '-r', String(args.dpi), '-f', String(args.firstPage)];
  if (args.lastPage !== null) {
    pdftoppmArgs.push('-l', String(args.lastPage));
  }
  pdftoppmArgs.push(pdfPath, prefixPath);

  runChecked(pdftoppmBin, pdftoppmArgs);

  const files = readdirSync(outputDir)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => join(outputDir, name));

  if (files.length === 0) {
    throw new Error('No PNG pages were generated.');
  }

  const summary = {
    input_docx: inputPath,
    output_dir: outputDir,
    prefix,
    dpi: args.dpi,
    first_page: args.firstPage,
    last_page: args.lastPage,
    page_count: files.length,
    pages: files,
    intermediate_pdf: pdfPath,
    renderer: {
      docx_to_pdf: 'libreoffice',
      pdf_to_png: 'pdftoppm',
    },
  };

  if (!args.keepPdf) {
    rmSync(pdfPath, { force: true });
    rmSync(tempDir, { recursive: true, force: true });
    summary.intermediate_pdf = null;
  }

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('DOCX render complete');
    console.log(`Input: ${summary.input_docx}`);
    console.log(`Pages rendered: ${summary.page_count}`);
    console.log(`PNG output: ${summary.output_dir}`);
    for (const pagePath of summary.pages) {
      console.log(`- ${pagePath}`);
    }
    if (summary.intermediate_pdf) {
      console.log(`Intermediate PDF: ${summary.intermediate_pdf}`);
    }
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`render_docx_pages failed: ${message}`);
  process.exitCode = 1;
}

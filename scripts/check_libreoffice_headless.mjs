#!/usr/bin/env node

import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolveLibreOfficeBinary } from './libreoffice_headless.mjs';

function parseArgs(argv) {
  const parsed = {
    input: resolve('content/templates/openagreements-employment-offer-letter/template.docx'),
    quiet: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') {
      parsed.input = resolve(argv[++i] ?? '');
      continue;
    }
    if (arg === '--quiet') {
      parsed.quiet = true;
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

  return parsed;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/check_libreoffice_headless.mjs [options]',
      '',
      'Runs a DOCX -> PDF smoke test using the configured LibreOffice binary.',
      '',
      'Options:',
      '  -i, --input <path>   Input DOCX to use for smoke conversion',
      '      --quiet          Print only errors',
      '      --json           Emit JSON summary',
      '  -h, --help           Show help',
    ].join('\n')
  );
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error) {
    throw new Error(`Failed to execute ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    const stdout = result.stdout?.trim() ?? '';
    const termination =
      result.status === null ? `signal ${result.signal ?? 'unknown'}` : `exit code ${result.status}`;
    const details = [stderr, stdout].filter((value) => value.length > 0).join('\n');
    throw new Error(`${command} failed with ${termination}${details ? `: ${details}` : ''}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const soffice = resolveLibreOfficeBinary();
  const profileDir = mkdtempSync(join(tmpdir(), 'oa-lo-profile-'));
  const outputDir = mkdtempSync(join(tmpdir(), 'oa-lo-smoke-'));

  const inputPath = args.input;
  const inputBase = basename(inputPath, extname(inputPath));
  const outputPdf = join(outputDir, `${inputBase}.pdf`);

  try {
    runChecked(
      soffice.command,
      [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--invisible',
        '--nodefault',
        '--nolockcheck',
        '--nologo',
        '--norestore',
        '--convert-to',
        'pdf:writer_pdf_Export',
        '--outdir',
        outputDir,
        inputPath,
      ],
      {
        env: {
          ...process.env,
          SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN ?? 'svp',
        },
      }
    );

    statSync(outputPdf);

    const summary = {
      ok: true,
      input_docx: inputPath,
      output_pdf: outputPdf,
      soffice_command: soffice.command,
      soffice_source: soffice.source,
      soffice_version: soffice.version,
      expected_version: soffice.expectedVersion,
      pinned: soffice.pinned,
      pin_config: soffice.configPath,
      pinned_cask: soffice.cask,
    };

    if (args.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    if (!args.quiet) {
      console.log('LibreOffice headless smoke check passed');
      console.log(`Binary: ${summary.soffice_command}`);
      console.log(`Version: ${summary.soffice_version}`);
      console.log(`Input: ${summary.input_docx}`);
    }
  } finally {
    rmSync(profileDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`check_libreoffice_headless failed: ${message}`);
  process.exitCode = 1;
}

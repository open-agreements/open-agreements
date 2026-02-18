import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveLibreOfficeBinary } from './libreoffice_headless.mjs';

const ROOT = resolve('.');
const TARGETS = [
  resolve(ROOT, 'content/templates/openagreements-employment-offer-letter/template.docx'),
  resolve(ROOT, 'content/templates/openagreements-employee-ip-inventions-assignment/template.docx'),
  resolve(ROOT, 'content/templates/openagreements-employment-confidentiality-acknowledgement/template.docx'),
];

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'pipe', ...options });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString('utf-8') ?? '';
    const stdout = result.stdout?.toString('utf-8') ?? '';
    const termination =
      result.status === null ? `signal ${result.signal ?? 'unknown'}` : `exit code ${result.status}`;
    throw new Error(`${cmd} ${args.join(' ')} failed (${termination})\n${stdout}\n${stderr}`.trim());
  }
}

function normalizeDocxWithLibreOffice(libreofficeCmd, templatePath) {
  const tempDir = mkdtempSync(join(tmpdir(), 'oa-libreoffice-docx-'));
  const profileDir = mkdtempSync(join(tmpdir(), 'oa-libreoffice-profile-'));
  try {
    const tempInput = join(tempDir, basename(templatePath));
    copyFileSync(templatePath, tempInput);

    run(
      libreofficeCmd,
      [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--invisible',
        '--nodefault',
        '--nolockcheck',
        '--nologo',
        '--norestore',
        '--convert-to',
        'docx',
        '--outdir',
        tempDir,
        tempInput,
      ],
      {
        env: {
          ...process.env,
          SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN ?? 'svp',
        },
      }
    );

    const normalizedPath = join(tempDir, basename(templatePath));
    if (!existsSync(normalizedPath)) {
      throw new Error(`LibreOffice did not emit expected output: ${normalizedPath}`);
    }

    copyFileSync(normalizedPath, templatePath);
    console.log(`[ok] normalized ${templatePath}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(profileDir, { recursive: true, force: true });
  }
}

const { command: libreofficeCmd, version: libreofficeVersion } = resolveLibreOfficeBinary();
console.log(`Using LibreOffice binary: ${libreofficeCmd} (${libreofficeVersion})`);

for (const target of TARGETS) {
  normalizeDocxWithLibreOffice(libreofficeCmd, target);
}

console.log('LibreOffice normalization complete.');

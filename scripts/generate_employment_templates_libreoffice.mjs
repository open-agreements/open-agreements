import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve('.');
const TARGETS = [
  resolve(ROOT, 'templates/openagreements-employment-offer-letter/template.docx'),
  resolve(ROOT, 'templates/openagreements-employee-ip-inventions-assignment/template.docx'),
  resolve(ROOT, 'templates/openagreements-employment-confidentiality-acknowledgement/template.docx'),
];

function commandExists(cmd) {
  const probe = spawnSync(cmd, ['--version'], { stdio: 'pipe' });
  return probe.status === 0;
}

function detectLibreOfficeCommand() {
  if (commandExists('soffice')) {
    return 'soffice';
  }
  if (commandExists('libreoffice')) {
    return 'libreoffice';
  }
  return null;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'pipe' });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString('utf-8') ?? '';
    const stdout = result.stdout?.toString('utf-8') ?? '';
    throw new Error(`${cmd} ${args.join(' ')} failed\n${stdout}\n${stderr}`.trim());
  }
}

function normalizeDocxWithLibreOffice(libreofficeCmd, templatePath) {
  const tempDir = mkdtempSync(join(tmpdir(), 'oa-libreoffice-docx-'));
  try {
    const tempInput = join(tempDir, basename(templatePath));
    copyFileSync(templatePath, tempInput);

    run(libreofficeCmd, ['--headless', '--convert-to', 'docx', '--outdir', tempDir, tempInput]);

    const normalizedPath = join(tempDir, basename(templatePath));
    if (!existsSync(normalizedPath)) {
      throw new Error(`LibreOffice did not emit expected output: ${normalizedPath}`);
    }

    copyFileSync(normalizedPath, templatePath);
    console.log(`[ok] normalized ${templatePath}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const libreofficeCmd = detectLibreOfficeCommand();
if (!libreofficeCmd) {
  console.error('LibreOffice is required for this optional step. Install and ensure `soffice` is on PATH.');
  console.error('macOS (Homebrew): brew install --cask libreoffice');
  process.exit(1);
}

for (const target of TARGETS) {
  normalizeDocxWithLibreOffice(libreofficeCmd, target);
}

console.log('LibreOffice normalization complete.');

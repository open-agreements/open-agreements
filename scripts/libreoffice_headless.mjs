import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function runVersionProbe(command) {
  const primary = spawnSync(command, ['--version'], { encoding: 'utf-8' });
  if (!primary.error && primary.status === 0) {
    return primary;
  }

  const fallback = spawnSync(command, ['-v'], { encoding: 'utf-8' });
  if (!fallback.error && fallback.status === 0) {
    return fallback;
  }

  return primary;
}

function parseVersion(output) {
  const text = output.trim();
  const match = text.match(/LibreOffice\s+([0-9][0-9A-Za-z.\-]+)/i);
  if (match?.[1]) {
    return match[1];
  }
  return text.length > 0 ? text : 'unknown';
}

function isTruthy(value) {
  if (!value) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function libreOfficePinnedSetupHint() {
  return [
    'Set pinned LibreOffice values via repo config or env vars:',
    '  config/libreoffice-headless.json (recommended)',
    '  OR',
    '  export OA_SOFFICE_PIN_PATH="/Applications/LibreOffice.app/Contents/MacOS/soffice"',
    '  export OA_SOFFICE_PIN_VERSION="<exact-version-from-soffice---version>"',
    '',
    'Then run:',
    '  npm run check:libreoffice',
    '',
    'Temporary opt-out (not recommended for CI):',
    '  export OA_ALLOW_UNPINNED_SOFFICE=1',
  ].join('\n');
}

function loadPinnedConfig(options = {}) {
  const env = options.env ?? process.env;
  const configPath = resolve(options.configPath ?? env.OA_SOFFICE_PIN_CONFIG ?? 'config/libreoffice-headless.json');
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const body = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(body);
    const platformEntry = parsed?.[process.platform];
    if (!platformEntry || typeof platformEntry !== 'object') {
      return null;
    }
    return {
      configPath,
      sofficePath: typeof platformEntry.sofficePath === 'string' ? platformEntry.sofficePath.trim() : '',
      expectedVersion: typeof platformEntry.expectedVersion === 'string' ? platformEntry.expectedVersion.trim() : '',
      cask: typeof platformEntry.cask === 'string' ? platformEntry.cask.trim() : '',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse LibreOffice pin config (${configPath}): ${message}`);
  }
}

export function resolveLibreOfficeBinary(options = {}) {
  const env = options.env ?? process.env;
  const enforcePinnedOnDarwin = options.enforcePinnedOnDarwin ?? true;
  const allowUnpinned = isTruthy(env.OA_ALLOW_UNPINNED_SOFFICE);
  const pinnedConfig = loadPinnedConfig(options);

  const explicitSoffice = env.SOFFICE_BIN?.trim();
  const pinnedSoffice = env.OA_SOFFICE_PIN_PATH?.trim() || pinnedConfig?.sofficePath || '';
  const expectedVersion = env.OA_SOFFICE_PIN_VERSION?.trim() || pinnedConfig?.expectedVersion || '';

  let command;
  let source;
  if (explicitSoffice) {
    command = explicitSoffice;
    source = 'SOFFICE_BIN';
  } else if (pinnedSoffice) {
    command = pinnedSoffice;
    source = 'OA_SOFFICE_PIN_PATH';
  } else {
    const mustPin = process.platform === 'darwin' && enforcePinnedOnDarwin && !allowUnpinned;
    if (mustPin) {
      throw new Error(
        [
          'macOS rendering requires a pinned LibreOffice binary.',
          libreOfficePinnedSetupHint(),
        ].join('\n')
      );
    }
    command = 'soffice';
    source = 'PATH';
  }

  if (source !== 'PATH' && command.includes('/') && !existsSync(command)) {
    throw new Error(`Configured LibreOffice binary was not found: ${command}`);
  }

  const probe = runVersionProbe(command);
  if (probe.error || probe.status !== 0) {
    const stderr = probe.stderr?.trim() ?? '';
    const details = probe.error ? probe.error.message : stderr;
    throw new Error(`Failed to execute ${command} --version${details ? `: ${details}` : ''}`);
  }

  const version = parseVersion(probe.stdout ?? probe.stderr ?? '');
  if (expectedVersion && version !== expectedVersion) {
    throw new Error(
      `Pinned LibreOffice version mismatch: expected "${expectedVersion}" but found "${version}" (${command})`
    );
  }

  return {
    command,
    source,
    version,
    expectedVersion: expectedVersion || null,
    pinned: source !== 'PATH' || Boolean(expectedVersion),
    configPath: pinnedConfig?.configPath ?? null,
    cask: pinnedConfig?.cask ?? null,
  };
}

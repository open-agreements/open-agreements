import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  collectOpenSpecBindingsFromSource,
  collectScenarioIdsFromActiveChangeSpecs,
  computeUnknownScenarioIds,
  main,
  parseArgs,
  parseScenariosFromSpec,
} from '../scripts/validate_openspec_coverage.mjs';

const it = itAllure.epic('Verification & Drift').withLabels({ feature: 'OpenSpec Coverage Script' });

describe('validate_openspec_coverage script', () => {
  it.openspec('OA-DST-026')('parses args without writing matrix by default', () => {
    const parsed = parseArgs([]);
    expect(parsed.capabilities).toEqual([]);
    expect(parsed.writeMatrixPath).toBeNull();
  });

  it.openspec('OA-DST-026')('parses --write-matrix with default path when value is omitted', () => {
    const parsed = parseArgs(['--write-matrix'], '/tmp/open-agreements');
    expect(parsed.writeMatrixPath).toMatch(/integration-tests\/OPENSPEC_TRACEABILITY\.md$/);
  });

  it.openspec('OA-DST-026')('parses --write-matrix with a custom path relative to cwd', () => {
    const parsed = parseArgs(['--write-matrix', 'reports/matrix.md'], '/tmp/open-agreements');
    expect(parsed.writeMatrixPath).toBe('/tmp/open-agreements/reports/matrix.md');
  });

  it.openspec('OA-DST-026')('only writes a matrix when requested', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-speccov-'));
    const matrixPath = join(tempDir, 'traceability.md');
    try {
      process.exitCode = 0;
      await main(['--capability', 'open-agreements', '--capability', 'contracts-workspace']);
      expect(existsSync(matrixPath)).toBe(false);

      await main([
        '--capability',
        'open-agreements',
        '--capability',
        'contracts-workspace',
        '--write-matrix',
        matrixPath,
      ]);
      expect(existsSync(matrixPath)).toBe(true);
      expect(readFileSync(matrixPath, 'utf-8')).toContain('# OpenAgreements OpenSpec Traceability Matrix');
    } finally {
      process.exitCode = 0;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.openspec('OA-DST-014')('enforces behavior-oriented scenario bullets', () => {
    const specBody = [
      '## Requirements',
      '### Requirement: Example',
      '#### Scenario: [OA-900] Missing behavior bullets',
      '- **GIVEN** a setup exists',
      '- **AND** a second setup exists',
      '',
    ].join('\n');

    const parsed = parseScenariosFromSpec(specBody, 'openspec/specs/example/spec.md');
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('must include at least one **WHEN** bullet'),
        expect.stringContaining('must include at least one **THEN** bullet'),
      ]),
    );
  });

  it.openspec('OA-DST-015')('keeps canonical OpenSpec-to-Allure mappings green for open-agreements capability', async () => {
    const previousExitCode = process.exitCode;
    try {
      process.exitCode = 0;
      await main(['--capability', 'open-agreements', '--capability', 'contracts-workspace']);
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it.openspec('OA-DST-027')('rejects path-dependent scenario prose', () => {
    const specBody = [
      '## Requirements',
      '### Requirement: Example',
      '#### Scenario: [OA-901] Adapter coupling by source path',
      '- **GIVEN** the interface lives in `src/core/command-generation/types.ts`',
      '- **WHEN** a new adapter is implemented',
      '- **THEN** compilation succeeds',
      '',
    ].join('\n');

    const parsed = parseScenariosFromSpec(specBody, 'openspec/specs/example/spec.md');
    expect(parsed.errors.some((value) => value.includes('path-independent'))).toBe(true);
  });

  it.openspec('OA-DST-027')('accepts openspec mappings only from Allure wrappers', () => {
    const source = [
      "import { describe } from 'vitest';",
      "import { itAllure } from './helpers/allure-test.js';",
      "const it = itAllure.epic('Verification & Drift');",
      "describe('suite', () => {",
      "  it.openspec('OA-900')('maps to scenario', () => {});",
      '});',
      '',
    ].join('\n');

    const parsed = collectOpenSpecBindingsFromSource({
      relFile: 'integration-tests/fake-allure.test.ts',
      content: source,
    });

    expect(parsed.invalidBindings).toEqual([]);
    expect(parsed.bindingsByScenarioId.has('OA-900')).toBe(true);
  });

  it.openspec('OA-DST-028')('collects scenario IDs from active change-package specs', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-speccov-active-change-'));
    const changesRoot = join(tempDir, 'openspec', 'changes');
    const specPath = join(changesRoot, 'add-demo-capability', 'specs', 'open-agreements', 'spec.md');

    try {
      mkdirSync(join(changesRoot, 'add-demo-capability', 'specs', 'open-agreements'), { recursive: true });
      writeFileSync(
        specPath,
        [
          '## ADDED Requirements',
          '### Requirement: Demo requirement',
          '#### Scenario: [OA-950] Active change scenario ID',
          '- **WHEN** a test binds to OA-950',
          '- **THEN** the ID is recognized as a known scenario',
          '',
        ].join('\n'),
        'utf-8',
      );

      const { scenarioIdToSources } = await collectScenarioIdsFromActiveChangeSpecs({
        changesRoot,
        repoRoot: tempDir,
      });

      expect([...scenarioIdToSources.keys()]).toContain('OA-950');
      expect(scenarioIdToSources.get('OA-950')).toEqual([
        'openspec/changes/add-demo-capability/specs/open-agreements/spec.md',
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.openspec('OA-DST-028')('does not mark active-change scenario IDs as unknown', () => {
    const bindingsByScenarioId = new Map([
      ['OA-950', [{ ref: 'integration-tests/fake.ts:10 :: test', status: 'covered' }]],
      ['OA-951', [{ ref: 'integration-tests/fake.ts:12 :: test', status: 'covered' }]],
    ]);

    const knownScenarioIds = new Set(['OA-950']);
    const unknown = computeUnknownScenarioIds(bindingsByScenarioId, knownScenarioIds);

    expect(unknown).toEqual(['OA-951']);
  });

  it.openspec('OA-DST-027')('rejects openspec mappings from non-Allure wrappers', () => {
    const source = [
      "import { describe } from 'vitest';",
      'const it = {',
      "  openspec: () => (name, fn) => fn?.(),",
      '};',
      "describe('suite', () => {",
      "  it.openspec('OA-900')('maps to scenario', () => {});",
      '});',
      '',
    ].join('\n');

    const parsed = collectOpenSpecBindingsFromSource({
      relFile: 'integration-tests/fake-non-allure.test.ts',
      content: source,
    });

    expect(parsed.bindingsByScenarioId.size).toBe(0);
    expect(parsed.invalidBindings.some((value) => value.includes('must use an Allure wrapper'))).toBe(true);
  });
});

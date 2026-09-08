import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { runFieldSelector } from '../src/core/field-selector/index.js';

const it = itAllure.epic('Filling & Rendering');
const dirs: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(conjunctive = false) {
  const root = mkdtempSync(join(tmpdir(), 'oa-conditional-api-')); dirs.push(root);
  const dir = join(root, 'templates', 'synthetic', 'conditional-input-fixture'); mkdirSync(dir, { recursive: true });
  const fields = [
    { name: 'enabled', type: 'boolean', description: 'Enable optional regime', default: 'false' },
    ...(conjunctive ? [{ name: 'child', type: 'boolean', description: 'Nested election', default: 'false' }] : []),
    ...['start_date', 'interest_rate', 'frequency'].map(name => ({ name, type: 'string', description: name,
      required_when: conjunctive
        ? { all_of: [{ field: 'enabled', equals: true }, { field: 'child', equals: true }] }
        : { field: 'enabled', equals: true } })),
  ];
  writeFileSync(join(dir, 'metadata.yaml'), JSON.stringify({ name: 'Synthetic conditional fixture', artifact_type: 'field-selector',
    source_url: 'https://example.com/never-downloaded.docx', source_version: '1', license_note: 'Synthetic fixture', fields }));
  writeFileSync(join(dir, 'replacements.json'), '{}');
  return root;
}

describe('conditional input public entry points', () => {
  it('API and CLI reject active conjunctions before input I/O; inactive siblings do not require economics', async () => {
    const root = fixture(true); vi.stubEnv('OPEN_AGREEMENTS_CONTENT_ROOTS', root);
    const outputPath = join(root, 'out.docx');
    const inputPath = join(root, 'does-not-exist.docx');
    for (const value of [undefined, '', ' \t']) {
      const values = { enabled: true, child: true, start_date: value, interest_rate: '0', frequency: 'annual' };
      await expect(runFieldSelector({ fieldSelectorId: 'conditional-input-fixture', values, inputPath, outputPath }))
        .rejects.toMatchObject({ code: 'INCOMPLETE_CONDITIONAL_INPUT', fields: ['start_date'] });
      expect(existsSync(outputPath)).toBe(false);
    }
    for (const values of [{ enabled: false, child: true }, { enabled: true, child: false }, { child: true }]) {
      // Passing the conditional gate advances to the deliberately missing source.
      await expect(runFieldSelector({ fieldSelectorId: 'conditional-input-fixture', values, inputPath, outputPath }))
        .rejects.toThrow(/not.exist|ENOENT|Invalid filename/i);
      expect(existsSync(outputPath)).toBe(false);
    }
    const data = join(root, 'values.json');
    writeFileSync(data, JSON.stringify({ enabled: true, child: true, interest_rate: '0', frequency: 'annual' }));
    let error: unknown;
    try {
      execFileSync(process.execPath, [join(new URL('..', import.meta.url).pathname, 'bin/open-agreements.js'),
        'field-selector', 'run', 'conditional-input-fixture', '--data', data, '--output', outputPath, '--input', inputPath], {
        env: { ...process.env, OPEN_AGREEMENTS_CONTENT_ROOTS: root }, encoding: 'utf8', stdio: 'pipe',
      });
    } catch (caught) { error = caught; }
    expect(error).toMatchObject({ status: 1 });
    expect(String((error as { stderr: string }).stderr)).toContain('Incomplete conditional input: start_date');
    expect(existsSync(outputPath)).toBe(false);
  });

  it('API rejects every missing economic before touching input or output documents', async () => {
    const root = fixture(); vi.stubEnv('OPEN_AGREEMENTS_CONTENT_ROOTS', root);
    const complete = { enabled: true, start_date: '2030-01-01', interest_rate: '0', frequency: 'annual' };
    for (const name of ['start_date', 'interest_rate', 'frequency']) {
      const values: Record<string, unknown> = { ...complete }; delete values[name];
      const outputPath = join(root, `${name}.docx`);
      await expect(runFieldSelector({ fieldSelectorId: 'conditional-input-fixture', values,
        inputPath: join(root, 'does-not-exist.docx'), outputPath })).rejects.toMatchObject({
        code: 'INCOMPLETE_CONDITIONAL_INPUT', fields: [name],
      });
      expect(existsSync(outputPath)).toBe(false);
    }
  });

  it('CLI exits unsuccessfully with named missing fields and writes no output', () => {
    const root = fixture();
    const data = join(root, 'values.json'); const output = join(root, 'out.docx');
    writeFileSync(data, JSON.stringify({ enabled: true, interest_rate: '0' }));
    let error: unknown;
    try {
      execFileSync(process.execPath, [join(new URL('..', import.meta.url).pathname, 'bin/open-agreements.js'),
        'field-selector', 'run', 'conditional-input-fixture', '--data', data, '--output', output,
        '--input', join(root, 'does-not-exist.docx')], {
        env: { ...process.env, OPEN_AGREEMENTS_CONTENT_ROOTS: root }, encoding: 'utf8', stdio: 'pipe',
      });
    } catch (caught) { error = caught; }
    expect(error).toMatchObject({ status: 1 });
    expect(String((error as { stderr: string }).stderr)).toContain('Incomplete conditional input: start_date, frequency');
    expect(existsSync(output)).toBe(false);
  });
});

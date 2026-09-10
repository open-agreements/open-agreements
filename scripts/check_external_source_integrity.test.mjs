import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, expect, it} from 'vitest';
import {checkExternalSourceIntegrity} from './check_external_source_integrity.mjs';

const roots = [];
const dir = 'templates/yc-cc-by-nd-4.0/example';
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'external-integrity-')); roots.push(cwd);
  const git = (...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
  mkdirSync(join(cwd, dir), {recursive: true});
  const write = (name, value) => writeFileSync(join(cwd, dir, name), value);
  write('metadata.yaml', 'allow_derivatives: false\n'); write('template.docx', 'original bytes');
  const commit = () => {git('add', '.'); git('commit', '-m', 'fixture'); return git('rev-parse', 'HEAD').trim();};
  const base = commit();
  return {cwd, write, commit, base};
}
afterEach(() => {for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});});

it('allows administrative definitions without altering original content', () => {
  const f = fixture(); f.write('README.md', 'Field instructions'); f.write('anchored-paragraph-bindings.json', '{}');
  f.write('metadata.yaml', 'allow_derivatives: false\nfields: []\n'); f.commit();
  expect(checkExternalSourceIntegrity(f)).toEqual([]);
});
it.each(['template.docx', 'template.md', 'clean.json'])('blocks changed or added content: %s', name => {
  const f = fixture(); f.write(name, 'changed content'); f.commit();
  expect(checkExternalSourceIntegrity(f)).toEqual([`${dir}/${name}`]);
});
it('still protects the base original when metadata changes its flag', () => {
  const f = fixture(); f.write('metadata.yaml', 'allow_derivatives: true\n'); f.write('template.docx', 'changed'); f.commit();
  expect(checkExternalSourceIntegrity(f)).toEqual([`${dir}/template.docx`]);
});
it('blocks deletion even when the whole restricted directory disappears', () => {
  const f = fixture(); rmSync(join(f.cwd, dir), {recursive: true}); f.commit();
  expect(checkExternalSourceIntegrity(f)).toEqual([`${dir}/template.docx`]);
});
it('fails closed when the base revision cannot be resolved', () => {
  const f = fixture(); expect(() => checkExternalSourceIntegrity({...f, base: 'not-a-revision'})).toThrow();
});

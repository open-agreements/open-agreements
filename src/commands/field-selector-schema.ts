import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  canonicalSha256,
  getFieldSelectorInputSchema,
  type FieldSelectorSchemaManifest,
} from '../core/field-selector/input-schema.js';
import { listFieldSelectorIds, resolveFieldSelectorDir } from '../utils/paths.js';

export interface FieldSelectorSchemaArgs {
  fieldSelectorId?: string;
  output?: string;
  all?: boolean;
  outputDir?: string;
  runtimeRevision?: string;
}

function packageVersion(): string {
  return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version as string;
}

export function runFieldSelectorSchema(args: FieldSelectorSchemaArgs): void {
  if (args.all) {
    if (args.fieldSelectorId) throw new Error('Do not provide an id together with --all');
    if (!args.outputDir) throw new Error('--all requires --output-dir');
    if (!args.runtimeRevision || !/^[0-9a-f]{40}$/.test(args.runtimeRevision)) {
      throw new Error('--all requires --runtime-revision with a lowercase 40-character Git SHA');
    }
    const outputDir = resolve(args.outputDir);
    mkdirSync(outputDir, { recursive: true });
    const schemas = listFieldSelectorIds().sort().map((fieldSelectorId) => {
      const schema = getFieldSelectorInputSchema(fieldSelectorId, resolveFieldSelectorDir(fieldSelectorId));
      const path = `${fieldSelectorId}.schema.json`;
      writeFileSync(join(outputDir, path), `${JSON.stringify(schema, null, 2)}\n`);
      return { field_selector_id: fieldSelectorId, path, sha256: canonicalSha256(schema) };
    });
    const manifest: FieldSelectorSchemaManifest = {
      schema_version: 1,
      generator: 'open-agreements field-selector schema --all',
      package_version: packageVersion(),
      runtime_revision: args.runtimeRevision,
      canonicalization: 'RFC8785',
      schemas,
    };
    const manifestPath = join(outputDir, 'schema-manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({
      manifest_path: basename(manifestPath),
      manifest_sha256: canonicalSha256(manifest),
    }));
    return;
  }

  if (!args.fieldSelectorId) throw new Error('Provide a field-selector id or --all');
  const schema = getFieldSelectorInputSchema(
    args.fieldSelectorId,
    resolveFieldSelectorDir(args.fieldSelectorId),
  );
  const json = `${JSON.stringify(schema, null, 2)}\n`;
  if (args.output) writeFileSync(resolve(args.output), json);
  else process.stdout.write(json);
}


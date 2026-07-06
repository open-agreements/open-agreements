import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runFieldSelector, cleanDocument, patchDocument } from '../core/field-selector/index.js';
import { loadCleanConfig } from '../core/metadata.js';
import { listFieldSelectorIds, resolveFieldSelectorDir } from '../utils/paths.js';

export interface FieldSelectorRunArgs {
  fieldSelectorId: string;
  input?: string;
  output?: string;
  data?: string;
  keepIntermediate?: boolean;
  computedOut?: string;
  normalizeBrackets?: boolean;
}

export async function runFieldSelectorCommand(args: FieldSelectorRunArgs): Promise<void> {
  const fieldSelectorDir = resolveFieldSelectorDir(args.fieldSelectorId);

  if (!existsSync(fieldSelectorDir)) {
    const available = listFieldSelectorIds();
    console.error(`Field-selector "${args.fieldSelectorId}" not found.`);
    if (available.length > 0) {
      console.error(`Available field-selectors: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  let values: Record<string, unknown> = {};
  if (args.data) {
    values = JSON.parse(readFileSync(args.data, 'utf-8'));
  }

  const outputPath = resolve(args.output ?? `${args.fieldSelectorId}-filled.docx`);

  try {
    const result = await runFieldSelector({
      fieldSelectorId: args.fieldSelectorId,
      inputPath: args.input ? resolve(args.input) : undefined,
      outputPath,
      values,
      keepIntermediate: args.keepIntermediate,
      computedOutPath: args.computedOut ? resolve(args.computedOut) : undefined,
      normalizeBracketArtifacts: args.normalizeBrackets,
    });
    console.log(`Filled ${result.metadata.name}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning}`);
    }
    if (result.computedOutPath && result.computedArtifact) {
      console.log(`Computed artifact: ${result.computedOutPath}`);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export interface FieldSelectorCleanArgs {
  input: string;
  output: string;
  fieldSelector: string;
  extractGuidance?: string;
}

export async function runFieldSelectorClean(args: FieldSelectorCleanArgs): Promise<void> {
  const fieldSelectorDir = resolveFieldSelectorDir(args.fieldSelector);
  const config = loadCleanConfig(fieldSelectorDir);
  const inputPath = resolve(args.input);

  try {
    if (args.extractGuidance) {
      const sourceData = readFileSync(inputPath);
      const sourceHash = createHash('sha256').update(sourceData).digest('hex');
      const cleanPath = resolve(fieldSelectorDir, 'clean.json');
      const configData = existsSync(cleanPath) ? readFileSync(cleanPath, 'utf-8') : '{}';
      const configHash = createHash('sha256').update(configData).digest('hex');

      const result = await cleanDocument(inputPath, resolve(args.output), config, {
        extractGuidance: true,
        sourceHash,
        configHash,
      });
      if (result.guidance) {
        writeFileSync(resolve(args.extractGuidance), JSON.stringify(result.guidance, null, 2) + '\n');
        console.log(`Guidance: ${args.extractGuidance} (${result.guidance.entries.length} entries)`);
      }
    } else {
      await cleanDocument(inputPath, resolve(args.output), config);
    }
    console.log(`Cleaned: ${args.output}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export interface FieldSelectorPatchArgs {
  input: string;
  output: string;
  fieldSelector: string;
}

export async function runFieldSelectorPatch(args: FieldSelectorPatchArgs): Promise<void> {
  const fieldSelectorDir = resolveFieldSelectorDir(args.fieldSelector);
  const replacementsPath = resolve(fieldSelectorDir, 'replacements.json');
  const replacements: Record<string, string> = JSON.parse(readFileSync(replacementsPath, 'utf-8'));

  try {
    await patchDocument(resolve(args.input), resolve(args.output), replacements);
    console.log(`Patched: ${args.output}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

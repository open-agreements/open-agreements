import { resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fillTemplate } from '../core/engine.js';
import { getTemplatesDir, resolveTemplateDir } from '../utils/paths.js';

export interface FillArgs {
  template: string;
  output?: string;
  values: Record<string, string>;
}

export async function runFill(args: FillArgs): Promise<void> {
  const templateDir = resolveTemplateDir(args.template);

  if (!existsSync(templateDir)) {
    const available = getAvailableTemplates();
    console.error(`Template "${args.template}" not found.`);
    if (available.length > 0) {
      console.error(`Available templates: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  const outputPath = args.output ?? `${args.template}-filled.docx`;
  const resolvedOutput = resolve(outputPath);

  try {
    const result = await fillTemplate({
      templateDir,
      values: args.values,
      outputPath: resolvedOutput,
    });
    console.log(`Filled ${result.metadata.name}`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

function getAvailableTemplates(): string[] {
  const templatesDir = getTemplatesDir();
  if (!existsSync(templatesDir)) return [];
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

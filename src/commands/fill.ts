import { writeFile } from 'node:fs/promises';
import { parse, resolve } from 'node:path';
import { fillTemplate } from '../core/engine.js';
import { loadMetadata } from '../core/metadata.js';
import {
  findTemplateDir,
  findExternalDir,
  findRecipeDir,
  listTemplateIds,
  listExternalIds,
  listRecipeIds,
} from '../utils/paths.js';
import { runExternalFill } from '../core/external/index.js';
import { runRecipe } from '../core/recipe/index.js';
import {
  generateEmploymentMemo,
  isEmploymentTemplateId,
  renderEmploymentMemoMarkdown,
  type MemoFormat,
} from '../core/employment/memo.js';

interface FillMemoArgs {
  enabled: boolean;
  format: MemoFormat;
  jsonOutputPath?: string;
  markdownOutputPath?: string;
  jurisdiction?: string;
  baselineTemplateId?: string;
}

export interface FillArgs {
  template: string;
  output?: string;
  values: Record<string, string>;
  memo?: FillMemoArgs;
}

function validateTemplateFillRequest(templateDir: string, values: Record<string, string>): void {
  const metadata = loadMetadata(templateDir);

  if (!metadata.allow_derivatives) {
    throw new Error(
      `Template "${metadata.name}" has allow_derivatives=false and cannot be filled from templates/.`
    );
  }

  const missingRequired = metadata.required_fields.filter((fieldName) => !values[fieldName]);

  if (missingRequired.length > 0) {
    throw new Error(`Missing required fields: ${missingRequired.join(', ')}`);
  }
}

export async function runFill(args: FillArgs): Promise<void> {
  // Search templates/ → external/ → recipes/
  const templateDir = findTemplateDir(args.template);
  const externalDir = findExternalDir(args.template);
  const recipeDir = findRecipeDir(args.template);

  const isTemplate = templateDir !== undefined;
  const isExternal = !isTemplate && externalDir !== undefined;
  const isRecipe = !isTemplate && !isExternal && recipeDir !== undefined;

  if (!isTemplate && !isExternal && !isRecipe) {
    const available = getAvailableIds();
    console.error(`Agreement "${args.template}" not found in templates, external, or recipes.`);
    if (available.length > 0) {
      console.error(`Available: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  const outputPath = args.output ?? `${args.template}-filled.docx`;
  const resolvedOutput = resolve(outputPath);

  try {
    if (args.memo?.enabled && !isEmploymentTemplateId(args.template)) {
      throw new Error(
        `Memo generation is currently supported only for employment templates. Received template "${args.template}".`
      );
    }

    if (isRecipe) {
      const result = await runRecipe({
        recipeId: args.template,
        outputPath: resolvedOutput,
        values: args.values,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    } else if (isExternal) {
      const result = await runExternalFill({
        externalId: args.template,
        outputPath: resolvedOutput,
        values: args.values,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
    } else {
      validateTemplateFillRequest(templateDir!, args.values);
      const result = await fillTemplate({
        templateDir: templateDir!,
        values: args.values,
        outputPath: resolvedOutput,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);

      if (args.memo?.enabled) {
        const memo = generateEmploymentMemo({
          templateId: args.template,
          templateMetadata: result.metadata,
          values: args.values,
          jurisdiction: args.memo.jurisdiction,
          baselineTemplateId: args.memo.baselineTemplateId,
        });

        const memoOutputPaths = getMemoOutputPaths({
          outputPath: resolvedOutput,
          format: args.memo.format,
          jsonOutputPath: args.memo.jsonOutputPath,
          markdownOutputPath: args.memo.markdownOutputPath,
        });

        if (memoOutputPaths.jsonPath) {
          await writeFile(memoOutputPaths.jsonPath, `${JSON.stringify(memo, null, 2)}\n`, 'utf-8');
          console.log(`Memo JSON: ${memoOutputPaths.jsonPath}`);
        }

        if (memoOutputPaths.markdownPath) {
          const markdown = renderEmploymentMemoMarkdown(memo);
          await writeFile(memoOutputPaths.markdownPath, `${markdown}\n`, 'utf-8');
          console.log(`Memo Markdown: ${memoOutputPaths.markdownPath}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

function getMemoOutputPaths(args: {
  outputPath: string;
  format: MemoFormat;
  jsonOutputPath?: string;
  markdownOutputPath?: string;
}): { jsonPath?: string; markdownPath?: string } {
  const outputParts = parse(args.outputPath);
  const defaultBase = resolve(outputParts.dir, outputParts.name || outputParts.base);

  const wantsJson = args.format === 'json' || args.format === 'both';
  const wantsMarkdown = args.format === 'markdown' || args.format === 'both';

  return {
    jsonPath: wantsJson
      ? resolve(args.jsonOutputPath ?? `${defaultBase}.memo.json`)
      : undefined,
    markdownPath: wantsMarkdown
      ? resolve(args.markdownOutputPath ?? `${defaultBase}.memo.md`)
      : undefined,
  };
}

function getAvailableIds(): string[] {
  return [...new Set([...listTemplateIds(), ...listExternalIds(), ...listRecipeIds()])];
}

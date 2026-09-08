import { writeFile } from 'node:fs/promises';
import { parse, resolve } from 'node:path';
import { fillTemplate } from '../core/engine.js';
import { loadMetadata, type TemplateMetadata } from '../core/metadata.js';
import {
  findTemplateDir,
  findExternalDir,
  findFieldSelectorDir,
  listTemplateIds,
  listExternalIds,
  listFieldSelectorIds,
} from '../utils/paths.js';
import { runExternalFill } from '../core/external/index.js';
import { runFieldSelector } from '../core/field-selector/index.js';
import {
  generateEmploymentMemo,
  renderEmploymentMemoMarkdown,
  type MemoFormat,
} from '../core/employment/memo.js';
import { generateFounderMemo, renderFounderMemoMarkdown } from '../core/founder/memo.js';
import {
  buildUnsupportedMemoFamilyMessage,
  resolveMemoDispatch,
  type MemoDispatch,
} from '../core/memo/families.js';

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
  values: Record<string, unknown>;
  memo?: FillMemoArgs;
}

function validateTemplateFillRequest(templateDir: string, values: Record<string, unknown>): void {
  const metadata = loadMetadata(templateDir);

  if (!metadata.allow_derivatives) {
    throw new Error(
      `Template "${metadata.name}" has allow_derivatives=false and cannot be filled from templates/.`
    );
  }

  const missingPriority = metadata.priority_fields.filter((fieldName) => {
    const value = values[fieldName];
    return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  });

  if (missingPriority.length > 0) {
    console.warn(`Note: ${missingPriority.length} priority fields are unfilled: ${missingPriority.join(', ')}`);
  }
}

export async function runFill(args: FillArgs): Promise<void> {
  // Search templates/ → external/ → field-selectors/
  const templateDir = findTemplateDir(args.template);
  const externalDir = findExternalDir(args.template);
  const fieldSelectorDir = findFieldSelectorDir(args.template);

  const isTemplate = templateDir !== undefined;
  const isExternal = !isTemplate && externalDir !== undefined;
  const isFieldSelector = !isTemplate && !isExternal && fieldSelectorDir !== undefined;

  if (!isTemplate && !isExternal && !isFieldSelector) {
    const available = getAvailableIds();
    console.error(`Agreement "${args.template}" not found in templates, external, or field-selectors.`);
    if (available.length > 0) {
      console.error(`Available: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  const outputPath = args.output ?? `${args.template}-filled.docx`;
  const resolvedOutput = resolve(outputPath);

  try {
    // Memo support is resolved per family. Before legal-explainer#2569/#2572
    // this was a single hardcoded set that rejected every state variant of the
    // offer letter and every founder template, and said only what was NOT
    // supported. The message now names what IS.
    const memoDispatch = args.memo?.enabled ? resolveMemoDispatch(args.template) : undefined;
    if (args.memo?.enabled && !memoDispatch) {
      throw new Error(buildUnsupportedMemoFamilyMessage(args.template));
    }

    if (isFieldSelector) {
      const result = await runFieldSelector({
        fieldSelectorId: args.template,
        outputPath: resolvedOutput,
        values: args.values,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
      for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
      }
    } else if (isExternal) {
      const result = await runExternalFill({
        externalId: args.template,
        outputPath: resolvedOutput,
        values: args.values,
      });
      console.log(`Filled ${result.metadata.name}`);
      console.log(`Output: ${result.outputPath}`);
      console.log(`Fields used: ${result.fieldsUsed.join(', ')}`);
      for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
      }
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
      for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
      }

      if (args.memo?.enabled && memoDispatch) {
        const rendered = buildMemoArtifacts({
          dispatch: memoDispatch,
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
          await writeFile(memoOutputPaths.jsonPath, `${JSON.stringify(rendered.memo, null, 2)}\n`, 'utf-8');
          console.log(`Memo JSON: ${memoOutputPaths.jsonPath}`);
        }

        if (memoOutputPaths.markdownPath) {
          await writeFile(memoOutputPaths.markdownPath, `${rendered.markdown}\n`, 'utf-8');
          console.log(`Memo Markdown: ${memoOutputPaths.markdownPath}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Route to the memo generator for the resolved family. Each family owns its own
 * artifact shape; both run the shared advice-language guard before returning.
 */
function buildMemoArtifacts(args: {
  dispatch: MemoDispatch;
  templateMetadata: TemplateMetadata;
  values: Record<string, unknown>;
  jurisdiction?: string;
  baselineTemplateId?: string;
}): { memo: unknown; markdown: string } {
  if (args.dispatch.family === 'founder-separation') {
    const memo = generateFounderMemo({
      templateId: args.dispatch.templateId,
      templateMetadata: args.templateMetadata,
      values: args.values,
    });
    return { memo, markdown: renderFounderMemoMarkdown(memo) };
  }

  const memo = generateEmploymentMemo({
    templateId: args.dispatch.templateId,
    templateMetadata: args.templateMetadata,
    values: args.values,
    jurisdiction: args.jurisdiction,
    baselineTemplateId: args.baselineTemplateId,
  });
  return { memo, markdown: renderEmploymentMemoMarkdown(memo) };
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
  return [...new Set([...listTemplateIds(), ...listExternalIds(), ...listFieldSelectorIds()])];
}

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ClosingChecklistSchema } from '../core/checklist/index.js';
import { renderChecklistMarkdown } from '../core/checklist/index.js';
import { fillTemplate } from '../core/engine.js';
import { findTemplateDir } from '../utils/paths.js';

export interface ChecklistCreateArgs {
  data: string;
  output?: string;
}

export interface ChecklistRenderArgs {
  data: string;
  output?: string;
}

export async function runChecklistCreate(args: ChecklistCreateArgs): Promise<void> {
  const raw = JSON.parse(readFileSync(args.data, 'utf-8'));
  const outputPath = resolve(args.output ?? 'closing-checklist.docx');

  // Pre-validate with the Zod schema for good error messages
  const parseResult = ClosingChecklistSchema.safeParse(raw);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map(
      (i) => `  ${i.path.join('.')}: ${i.message}`
    );
    console.error(`Validation errors:\n${issues.join('\n')}`);
    process.exit(1);
  }

  const c = parseResult.data;

  try {
    const templateDir = findTemplateDir('closing-checklist');
    if (!templateDir) {
      console.error('Error: closing-checklist template not found');
      process.exit(1);
    }

    await fillTemplate({
      templateDir,
      values: {
        deal_name: c.deal_name,
        created_at: c.created_at,
        updated_at: c.updated_at,
        working_group: c.working_group,
        documents: c.documents,
        action_items: c.action_items,
        open_issues: c.open_issues,
      },
      outputPath,
    });

    console.log(`Created closing checklist for "${c.deal_name}"`);
    console.log(`Output: ${outputPath}`);
    console.log(`Working group: ${c.working_group.length} members`);
    console.log(`Documents: ${c.documents.length}`);
    console.log(`Action items: ${c.action_items.length}`);
    console.log(`Open issues: ${c.open_issues.length}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

export async function runChecklistRender(args: ChecklistRenderArgs): Promise<void> {
  const raw = JSON.parse(readFileSync(args.data, 'utf-8'));
  const outputPath = args.output ? resolve(args.output) : undefined;

  try {
    const markdown = renderChecklistMarkdown(raw);

    if (outputPath) {
      await writeFile(outputPath, `${markdown}\n`, 'utf-8');
      console.log(`Markdown written to: ${outputPath}`);
    } else {
      console.log(markdown);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

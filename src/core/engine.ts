import { createReport } from 'docx-templates';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadMetadata, type TemplateMetadata } from './metadata.js';

export interface FillOptions {
  templateDir: string;
  values: Record<string, string>;
  outputPath: string;
}

export interface FillResult {
  outputPath: string;
  metadata: TemplateMetadata;
  fieldsUsed: string[];
}

export async function fillTemplate(options: FillOptions): Promise<FillResult> {
  const { templateDir, values, outputPath } = options;

  const metadata = loadMetadata(templateDir);

  if (!metadata.allow_derivatives) {
    throw new Error(
      `Template "${metadata.name}" has allow_derivatives=false (license: ${metadata.license}). ` +
      'Cannot generate derivatives of this template.'
    );
  }

  const missing = metadata.fields
    .filter((f) => f.required && !(f.name in values))
    .map((f) => f.name);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  const templatePath = join(templateDir, 'template.docx');
  const templateBuf = readFileSync(templatePath);

  const output = await createReport({
    template: templateBuf,
    data: values,
    cmdDelimiter: ['{', '}'],
    noSandbox: true,
  });

  writeFileSync(outputPath, output);

  return {
    outputPath,
    metadata,
    fieldsUsed: Object.keys(values),
  };
}

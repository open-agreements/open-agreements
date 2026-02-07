import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateMetadata } from '../core/metadata.js';
import { validateTemplate } from '../core/validation/template.js';
import { validateLicense } from '../core/validation/license.js';
import { getTemplatesDir, resolveTemplateDir } from '../utils/paths.js';

export interface ValidateArgs {
  template?: string;
}

export function runValidate(args: ValidateArgs): void {
  const templatesDir = getTemplatesDir();
  let templateIds: string[];

  if (args.template) {
    templateIds = [args.template];
  } else {
    if (!existsSync(templatesDir)) {
      console.error('No templates directory found.');
      process.exit(1);
    }
    templateIds = readdirSync(templatesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  let hasErrors = false;

  for (const id of templateIds) {
    const dir = resolveTemplateDir(id);
    console.log(`\nValidating: ${id}`);

    // Metadata validation
    const metaResult = validateMetadata(dir);
    if (!metaResult.valid) {
      hasErrors = true;
      console.error(`  FAIL metadata: ${metaResult.errors.join('; ')}`);
    } else {
      console.log('  PASS metadata');
    }

    // Template field matching
    const tmplResult = validateTemplate(dir, id);
    if (!tmplResult.valid) {
      hasErrors = true;
      for (const e of tmplResult.errors) console.error(`  FAIL template: ${e}`);
    } else {
      console.log('  PASS template');
    }
    for (const w of tmplResult.warnings) console.log(`  WARN template: ${w}`);

    // License compliance
    const licResult = validateLicense(dir, id);
    if (!licResult.valid) {
      hasErrors = true;
      for (const e of licResult.errors) console.error(`  FAIL license: ${e}`);
    } else {
      console.log('  PASS license');
    }
  }

  console.log(`\n${templateIds.length} template(s) validated.`);
  if (hasErrors) {
    console.error('Validation FAILED');
    process.exit(1);
  } else {
    console.log('Validation PASSED');
  }
}

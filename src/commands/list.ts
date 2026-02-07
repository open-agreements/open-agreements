import { readdirSync, existsSync } from 'node:fs';
import { loadMetadata } from '../core/metadata.js';
import { getTemplatesDir, resolveTemplateDir } from '../utils/paths.js';

export function runList(): void {
  const templatesDir = getTemplatesDir();

  if (!existsSync(templatesDir)) {
    console.log('No templates directory found.');
    return;
  }

  const dirs = readdirSync(templatesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (dirs.length === 0) {
    console.log('No templates found.');
    return;
  }

  console.log(`\n${'Template'.padEnd(40)} ${'License'.padEnd(14)} ${'Fields'.padEnd(8)} Source`);
  console.log('─'.repeat(100));

  for (const id of dirs) {
    const dir = resolveTemplateDir(id);
    try {
      const meta = loadMetadata(dir);
      const required = meta.fields.filter((f) => f.required).length;
      const total = meta.fields.length;
      console.log(
        `${id.padEnd(40)} ${meta.license.padEnd(14)} ${`${required}/${total}`.padEnd(8)} ${meta.source_url}`
      );
    } catch {
      console.log(`${id.padEnd(40)} ${'ERROR'.padEnd(14)} ${'—'.padEnd(8)} Could not load metadata`);
    }
  }

  console.log('');
}

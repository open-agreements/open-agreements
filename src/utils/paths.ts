import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Root of the open-agreements package */
export function getPackageRoot(): string {
  // From dist/utils/paths.js → go up to package root
  return join(__dirname, '..', '..');
}

/** Templates directory */
export function getTemplatesDir(): string {
  return join(getPackageRoot(), 'templates');
}

/** Resolve a specific template directory by ID */
export function resolveTemplateDir(templateId: string): string {
  return join(getTemplatesDir(), templateId);
}

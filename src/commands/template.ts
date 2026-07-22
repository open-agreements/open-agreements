import { getCliVersion, loadAgreementCatalog, type AgreementListItem } from './list.js';
import type { TemplateListField } from '../core/template-listing.js';

export interface TemplateShowOptions {
  json?: boolean;
}

export function runTemplateShow(templateId: string, opts: TemplateShowOptions = {}): void {
  const { items, errors } = loadAgreementCatalog();
  const item = items.find((candidate) => candidate.name === templateId);

  if (!item) {
    const loadError = errors.find((message) => message.startsWith(`template ${templateId}:`)
      || message.startsWith(`external ${templateId}:`)
      || message.startsWith(`field-selector ${templateId}:`));
    if (loadError) {
      throw new Error(`Could not load agreement "${templateId}": ${loadError}`);
    }
    throw new Error(
      `Unknown agreement "${templateId}". Run "open-agreements list" to see available IDs.`,
    );
  }

  if (opts.json) {
    console.log(JSON.stringify({
      schema_version: 1,
      cli_version: getCliVersion(),
      item,
    }, null, 2));
    return;
  }

  printHumanReadable(item);
}

function printHumanReadable(item: AgreementListItem): void {
  const fields = Array.isArray(item.fields) ? item.fields as TemplateListField[] : [];
  const priorityCount = fields.filter((field) => field.required).length;
  const title = stringValue(item.display_name) ?? item.name;

  console.log(`\n${title}`);
  printProperty('ID', item.name);
  printProperty('Kind', stringValue(item.artifact_type) ?? stringValue(item.tier));
  printProperty('Category', stringValue(item.category));
  printProperty('Stability', stringValue(item.stability));
  printProperty('Distribution', stringValue(item.distribution));
  printProperty('License', stringValue(item.license) ?? stringValue(item.license_note));
  printProperty('Source', stringValue(item.source));
  printProperty('Source version', stringValue(item.source_version));
  printProperty('Source URL', stringValue(item.source_url));
  printProperty('Derived from', stringValue(item.derived_from));
  printProperty('Description', stringValue(item.description));

  const credits = normalizeCredits(item.credits);
  if (credits.length > 0) {
    console.log('Credits:');
    for (const credit of credits) {
      console.log(`  - ${credit.name}${credit.role ? ` — ${credit.role}` : ''}`);
    }
  }

  console.log(`Fields (${priorityCount} priority / ${fields.length} total):`);
  if (fields.length === 0) {
    console.log('  None');
  } else {
    for (const field of fields) {
      printField(field, 1);
    }
  }
  console.log('');
}

function printField(field: TemplateListField, depth: number): void {
  const indent = '  '.repeat(depth);
  const label = field.display_label && field.display_label !== field.name
    ? `${field.display_label} (${field.name})`
    : field.name;
  const required = field.required ? ', priority' : '';
  console.log(`${indent}- ${label} [${field.type}${required}]`);
  if (field.description) console.log(`${indent}  ${field.description}`);
  if (field.default !== null) console.log(`${indent}  Default: ${field.default}`);
  if (field.options && field.options.length > 0) {
    console.log(`${indent}  Options: ${field.options.join(', ')}`);
  }
  for (const child of field.items ?? []) {
    printField(child, depth + 1);
  }
}

function printProperty(label: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    console.log(`${label}: ${value}`);
  }
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function normalizeCredits(value: unknown): Array<{ name: string; role?: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((credit) => {
    if (!credit || typeof credit !== 'object' || Array.isArray(credit)) return [];
    const record = credit as Record<string, unknown>;
    if (typeof record.name !== 'string') return [];
    return [{
      name: record.name,
      ...(typeof record.role === 'string' ? { role: record.role } : {}),
    }];
  });
}

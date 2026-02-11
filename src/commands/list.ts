import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadMetadata, loadRecipeMetadata, loadExternalMetadata } from '../core/metadata.js';
import { listExternalEntries, listRecipeEntries, listTemplateEntries } from '../utils/paths.js';

const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

export interface ListOptions {
  json?: boolean;
  jsonStrict?: boolean;
  templatesOnly?: boolean;
}

interface ListItem {
  name: string;
  [key: string]: unknown;
}

/** Extract a human-friendly source name from a URL */
function sourceName(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const map: Record<string, string> = {
      'commonpaper.com': 'Common Paper',
      'bonterms.com': 'Bonterms',
      'ycombinator.com': 'Y Combinator',
      'bookface-static.ycombinator.com': 'Y Combinator',
      'nvca.org': 'NVCA',
    };
    return map[host] ?? host;
  } catch {
    return null;
  }
}

export function runList(opts: ListOptions = {}): void {
  if (opts.json || opts.jsonStrict) {
    runListJson(opts);
    return;
  }
  listAgreementsWithOptions(opts);
}

function mapFields(fields: { name: string; type: string; required: boolean; section?: string; description: string; default?: string }[]) {
  return fields.map((f) => ({
    name: f.name,
    type: f.type,
    required: f.required,
    section: f.section ?? null,
    description: f.description,
    default: f.default ?? null,
  }));
}

function runListJson(opts: ListOptions): void {
  const results: ListItem[] = [];
  const errors: string[] = [];
  const templatesOnly = opts.templatesOnly === true;

  // Templates
  for (const entry of listTemplateEntries()) {
    const id = entry.id;
    const dir = entry.dir;
    try {
      const meta = loadMetadata(dir);
      results.push({
        name: id,
        description: meta.description ?? meta.name,
        license: meta.license,
        source_url: meta.source_url,
        source: sourceName(meta.source_url),
        attribution_text: meta.attribution_text,
        fields: mapFields(meta.fields),
      });
    } catch (err) {
      errors.push(`template ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!templatesOnly) {
    // External templates
    for (const entry of listExternalEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadExternalMetadata(dir);
        results.push({
          name: id,
          description: meta.description ?? meta.name,
          license: meta.license,
          source_url: meta.source_url,
          source: sourceName(meta.source_url),
          attribution_text: meta.attribution_text,
          fields: mapFields(meta.fields),
        });
      } catch (err) {
        errors.push(`external ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Recipes
    for (const entry of listRecipeEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadRecipeMetadata(dir);
        results.push({
          name: id,
          description: meta.description ?? meta.name,
          license_note: meta.license_note,
          source_url: meta.source_url,
          source: sourceName(meta.source_url),
          source_version: meta.source_version,
          optional: meta.optional,
          fields: mapFields(meta.fields),
        });
      } catch (err) {
        errors.push(`recipe ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name));

  if (opts.jsonStrict && errors.length > 0) {
    for (const msg of errors) {
      console.error(`error: ${msg}`);
    }
    process.exit(1);
  }

  const envelope = {
    schema_version: 1,
    cli_version: pkg.version,
    items: results,
  };
  console.log(JSON.stringify(envelope, null, 2));
}

function listAgreementsWithOptions(opts: ListOptions): void {
  interface Row { id: string; license: string; required: number; total: number; source: string; sourceUrl: string }
  const rows: Row[] = [];
  const templatesOnly = opts.templatesOnly === true;

  for (const entry of listTemplateEntries()) {
    const id = entry.id;
    const dir = entry.dir;
    try {
      const meta = loadMetadata(dir);
      const required = meta.fields.filter((f) => f.required).length;
      rows.push({ id, license: meta.license, required, total: meta.fields.length, source: sourceName(meta.source_url) || '—', sourceUrl: meta.source_url });
    } catch {
      rows.push({ id, license: 'ERROR', required: 0, total: 0, source: '—', sourceUrl: 'Could not load metadata' });
    }
  }

  if (!templatesOnly) {
    for (const entry of listExternalEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadExternalMetadata(dir);
        const required = meta.fields.filter((f) => f.required).length;
        rows.push({ id, license: meta.license, required, total: meta.fields.length, source: sourceName(meta.source_url) || '—', sourceUrl: meta.source_url });
      } catch {
        rows.push({ id, license: 'ERROR', required: 0, total: 0, source: '—', sourceUrl: 'Could not load metadata' });
      }
    }

    for (const entry of listRecipeEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadRecipeMetadata(dir);
        const required = meta.fields.filter((f) => f.required).length;
        const license = meta.optional ? 'recipe*' : 'recipe';
        rows.push({ id, license, required, total: meta.fields.length, source: sourceName(meta.source_url) || '—', sourceUrl: meta.source_url });
      } catch {
        rows.push({ id, license: 'ERROR', required: 0, total: 0, source: '—', sourceUrl: 'Could not load metadata' });
      }
    }
  }

  if (rows.length === 0) {
    console.log('No agreements found.');
    return;
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));

  console.log(`\n${'Agreement'.padEnd(40)} ${'License'.padEnd(14)} ${'Fields'.padEnd(8)} ${'Source'.padEnd(16)} URL`);
  console.log('─'.repeat(120));

  for (const row of rows) {
    const fields = row.license === 'ERROR' ? '—' : `${row.required}/${row.total}`;
    console.log(
      `${row.id.padEnd(40)} ${row.license.padEnd(14)} ${fields.padEnd(8)} ${row.source.padEnd(16)} ${row.sourceUrl}`
    );
  }

  console.log('');
}

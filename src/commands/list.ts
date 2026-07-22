import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadMetadata, loadFieldSelectorMetadata, loadExternalMetadata } from '../core/metadata.js';
import { categoryFromId, sourceName, mapFields } from '../core/template-listing.js';
import { listExternalEntries, listFieldSelectorEntries, listTemplateEntries } from '../utils/paths.js';

const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

export interface ListOptions {
  json?: boolean;
  jsonStrict?: boolean;
}

export interface AgreementListItem {
  name: string;
  [key: string]: unknown;
}

export interface AgreementCatalog {
  items: AgreementListItem[];
  errors: string[];
}

export function getCliVersion(): string {
  return pkg.version as string;
}

export function runList(opts: ListOptions = {}): void {
  if (opts.json || opts.jsonStrict) {
    runListJson(opts);
    return;
  }
  listAgreementsWithOptions(opts);
}

function runListJson(opts: ListOptions): void {
  const { items, errors } = loadAgreementCatalog();

  if (opts.jsonStrict && errors.length > 0) {
    for (const msg of errors) {
      console.error(`error: ${msg}`);
    }
    process.exit(1);
  }

  const envelope = {
    schema_version: 1,
    cli_version: getCliVersion(),
    items,
  };
  console.log(JSON.stringify(envelope, null, 2));
}

/**
 * Load the complete agreement catalog once for every detailed discovery
 * surface. `list --json` and `template show` deliberately share this function
 * so their field, provenance, stability, and distribution shapes cannot drift.
 */
export function loadAgreementCatalog(): AgreementCatalog {
  const results: AgreementListItem[] = [];
  const errors: string[] = [];
  // Templates
  for (const entry of listTemplateEntries()) {
    const id = entry.id;
    const dir = entry.dir;
    try {
      const meta = loadMetadata(dir);
      results.push({
        name: id,
        tier: 'internal' as const,
        display_name: meta.name,
        category: meta.category ?? categoryFromId(id),
        description: meta.description ?? meta.name,
        license: meta.license,
        source_url: meta.source_url,
        source: sourceName(meta.source_url),
        attribution_text: meta.attribution_text,
        allow_derivatives: meta.allow_derivatives,
        distribution: meta.distribution ?? 'bundled',
        artifact_type: meta.artifact_type ?? 'template',
        stability: meta.stability ?? null,
        credits: meta.credits ?? [],
        derived_from: meta.derived_from,
        fields: mapFields(meta.fields, meta.priority_fields),
      });
    } catch (err) {
      errors.push(`template ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // External templates
    for (const entry of listExternalEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadExternalMetadata(dir);
        results.push({
          name: id,
          tier: 'external' as const,
          display_name: meta.name,
          category: (meta as Record<string, unknown>).category as string ?? categoryFromId(id),
          description: meta.description ?? meta.name,
          license: meta.license,
          source_url: meta.source_url,
          source: sourceName(meta.source_url),
          attribution_text: meta.attribution_text,
          allow_derivatives: meta.allow_derivatives,
          distribution: meta.distribution ?? 'bundled',
          artifact_type: meta.artifact_type ?? 'template',
          stability: meta.stability ?? null,
          credits: meta.credits ?? [],
          derived_from: meta.derived_from,
          fields: mapFields(meta.fields, meta.priority_fields),
        });
      } catch (err) {
        errors.push(`external ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // FieldSelectors
    for (const entry of listFieldSelectorEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadFieldSelectorMetadata(dir);
        const item: AgreementListItem = {
          name: id,
          tier: 'field-selector' as const,
          display_name: meta.name,
          category: (meta as Record<string, unknown>).category as string ?? categoryFromId(id),
          description: meta.description ?? meta.name,
          license_note: meta.license_note,
          source_url: meta.source_url,
          source: sourceName(meta.source_url),
          source_version: meta.source_version,
          optional: meta.optional,
          allow_derivatives: false,
          distribution: meta.distribution ?? 'linked',
          artifact_type: meta.artifact_type ?? 'field-selector',
          fields: mapFields(meta.fields, meta.priority_fields),
        };
        if (meta.market_data_citations) {
          item.market_data_citations = meta.market_data_citations;
        }
        results.push(item);
      } catch (err) {
        errors.push(`field-selector ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return { items: results, errors };
}

function listAgreementsWithOptions(_opts: ListOptions): void {
  interface Row { id: string; category: string; license: string; stability: string; priority: number; total: number; source: string; sourceUrl: string }
  const rows: Row[] = [];
  for (const entry of listTemplateEntries()) {
    const id = entry.id;
    const dir = entry.dir;
    try {
      const meta = loadMetadata(dir);
      const priority = meta.priority_fields.length;
      rows.push({
        id,
        category: categoryFromId(id),
        license: meta.license,
        stability: meta.stability ?? '—',
        priority,
        total: meta.fields.length,
        source: sourceName(meta.source_url) || '—',
        sourceUrl: meta.source_url,
      });
    } catch {
      rows.push({
        id,
        category: categoryFromId(id),
        license: 'ERROR',
        stability: '—',
        priority: 0,
        total: 0,
        source: '—',
        sourceUrl: 'Could not load metadata',
      });
    }
  }

  for (const entry of listExternalEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadExternalMetadata(dir);
        const priority = meta.priority_fields.length;
        rows.push({
          id,
          category: categoryFromId(id),
          license: meta.license,
          stability: meta.stability ?? '—',
          priority,
          total: meta.fields.length,
          source: sourceName(meta.source_url) || '—',
          sourceUrl: meta.source_url,
        });
      } catch {
        rows.push({
          id,
          category: categoryFromId(id),
          license: 'ERROR',
          stability: '—',
          priority: 0,
          total: 0,
          source: '—',
          sourceUrl: 'Could not load metadata',
        });
      }
    }

    for (const entry of listFieldSelectorEntries()) {
      const id = entry.id;
      const dir = entry.dir;
      try {
        const meta = loadFieldSelectorMetadata(dir);
        const priority = meta.priority_fields.length;
        const license = meta.optional ? 'field-selector*' : 'field-selector';
        rows.push({
          id,
          category: categoryFromId(id),
          license,
          stability: '—',
          priority,
          total: meta.fields.length,
          source: sourceName(meta.source_url) || '—',
          sourceUrl: meta.source_url,
        });
      } catch {
        rows.push({
          id,
          category: categoryFromId(id),
          license: 'ERROR',
          stability: '—',
          priority: 0,
          total: 0,
          source: '—',
          sourceUrl: 'Could not load metadata',
        });
      }
    }

  if (rows.length === 0) {
    console.log('No agreements found.');
    return;
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));

  console.log(
    `\n${'Agreement'.padEnd(40)} ${'Category'.padEnd(12)} ${'License'.padEnd(14)} ${'Stability'.padEnd(14)} ${'Fields'.padEnd(8)} ${'Source'.padEnd(16)} URL`
  );
  console.log('─'.repeat(130));

  for (const row of rows) {
    const fields = row.license === 'ERROR' ? '—' : `${row.priority}/${row.total}`;
    console.log(
      `${row.id.padEnd(40)} ${row.category.padEnd(12)} ${row.license.padEnd(14)} ${row.stability.padEnd(14)} ${fields.padEnd(8)} ${row.source.padEnd(16)} ${row.sourceUrl}`
    );
  }

  console.log('');
}

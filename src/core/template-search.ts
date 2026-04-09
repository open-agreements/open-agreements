/**
 * BM25 template search via MiniSearch.
 *
 * Builds an in-memory index from the template list on each call (sub-millisecond
 * at 100+ templates). No caching, no persistence — stateless and serverless-safe.
 */

import MiniSearch from 'minisearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateSearchDocument {
  id: string;
  display_name: string;
  description: string;
  category: string;
  source: string;
  field_names: string;
  section_names: string;
}

export interface TemplateSearchResult {
  template_id: string;
  display_name: string;
  category: string;
  description: string;
  source: string | null;
  field_count: number;
  score: number;
}

export interface TemplateSearchOptions {
  query: string;
  category?: string;
  source?: string;
  max_results?: number;
}

/** Minimal shape required from TemplateItem — avoids coupling to _shared.ts types. */
interface TemplateItemLike {
  name: string;
  display_name: string;
  category: string;
  description: string;
  source: string | null;
  fields: { name: string; section: string | null }[];
}

// ---------------------------------------------------------------------------
// Index construction
// ---------------------------------------------------------------------------

function toSearchDocument(template: TemplateItemLike): TemplateSearchDocument {
  const sections = new Set<string>();
  const fieldNames: string[] = [];

  for (const field of template.fields) {
    fieldNames.push(field.name.replace(/_/g, ' '));
    if (field.section) sections.add(field.section);
  }

  return {
    id: template.name,
    display_name: template.display_name,
    description: template.description,
    // Hyphens → spaces for tokenization (MiniSearch splits on whitespace)
    category: template.category.replace(/-/g, ' '),
    source: template.source ?? '',
    field_names: fieldNames.join(' '),
    section_names: [...sections].join(' '),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function searchTemplates(
  templates: TemplateItemLike[],
  options: TemplateSearchOptions,
): TemplateSearchResult[] {
  const maxResults = options.max_results ?? 10;

  const index = new MiniSearch<TemplateSearchDocument>({
    fields: ['display_name', 'description', 'category', 'source', 'field_names', 'section_names'],
    storeFields: ['id'],
    searchOptions: {
      boost: {
        display_name: 3,
        description: 2,
        category: 1.5,
        source: 1.5,
        field_names: 1,
        section_names: 0.5,
      },
      prefix: true,
      fuzzy: (term: string) => (term.length <= 3 ? false : 0.2),
    },
  });

  // Build lookup map for original template data (preserves original category/source values)
  const templateMap = new Map<string, TemplateItemLike>();
  for (const t of templates) {
    index.add(toSearchDocument(t));
    templateMap.set(t.name, t);
  }

  const raw = index.search(options.query);

  // Map hits back to original template data (not MiniSearch stored fields)
  let results: TemplateSearchResult[] = raw.flatMap((hit) => {
    const t = templateMap.get(hit.id as string);
    if (!t) return [];
    return [{
      template_id: t.name,
      display_name: t.display_name,
      category: t.category,
      description: t.description,
      source: t.source,
      field_count: t.fields.length,
      score: hit.score,
    }];
  });

  // Exact case-insensitive post-filters
  if (options.category) {
    const cat = options.category.toLowerCase();
    results = results.filter((r) => r.category.toLowerCase() === cat);
  }
  if (options.source) {
    const src = options.source.toLowerCase();
    results = results.filter((r) => r.source?.toLowerCase() === src);
  }

  return results.slice(0, maxResults);
}

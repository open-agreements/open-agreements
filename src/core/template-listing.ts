/**
 * Shared template-listing module.
 *
 * Canonical helpers for listing templates with metadata, used by:
 * - CLI `list --json` command
 * - Vercel API `_shared.ts`
 * - MCP `tools.ts` (via dynamic import or npm dependency)
 */

import { loadMetadata, type FieldDefinition } from './metadata.js';
import { listTemplateEntries } from '../utils/paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateListField {
  name: string;
  type: string;
  required: boolean;
  section: string | null;
  description: string;
  display_label?: string | null;
  default: string | null;
  default_value_rationale: string | null;
  items?: TemplateListField[];
}

export interface TemplateListItem {
  name: string;
  display_name: string;
  category: string;
  description: string;
  license?: string;
  source_url: string;
  source: string | null;
  attribution_text?: string;
  allow_derivatives: boolean;
  fields: TemplateListField[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function categoryFromId(id: string): string {
  if (id.includes('employment') || id.includes('employee-ip-inventions') || id.includes('restrictive-covenant')) {
    return 'employment';
  }
  return 'general';
}

/** Extract a human-friendly source name from a URL */
export function sourceName(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname;

    if (host === 'github.com' && pathname.startsWith('/open-agreements/')) {
      return 'OpenAgreements';
    }
    if (host === 'github.com' && pathname.startsWith('/cooleyLLP/seriesseed')) {
      return 'Series Seed';
    }
    if (host === 'github.com' && pathname.startsWith('/papertrail/legal-docs')) {
      return 'Papertrail';
    }
    if (host === 'github.com' && pathname.startsWith('/docusign/')) {
      return 'DocuSign';
    }

    const map: Record<string, string> = {
      'commonpaper.com': 'Common Paper',
      'bonterms.com': 'Bonterms',
      'ycombinator.com': 'Y Combinator',
      'bookface-static.ycombinator.com': 'Y Combinator',
      'nvca.org': 'NVCA',
      'openagreements.ai': 'OpenAgreements',
    };

    // For github.com URLs without a special-cased path, surface the
    // org/owner segment as the source — that's the publishing entity for
    // CC-BY-style attribution (e.g. github.com/Bonterms/Mutual-NDA → Bonterms).
    // A small org map normalizes display names where the github handle
    // differs from the conventional brand (CommonPaper → Common Paper).
    if (host === 'github.com') {
      const org = pathname.split('/').filter(Boolean)[0];
      if (org) {
        const orgMap: Record<string, string> = {
          CommonPaper: 'Common Paper',
        };
        return orgMap[org] ?? org;
      }
    }

    return map[host] ?? host;
  } catch {
    return null;
  }
}

export function mapFields(
  fields: FieldDefinition[],
  priorityFields: string[],
): TemplateListField[] {
  const required = new Set(priorityFields);
  return fields.map((f) => ({
    name: f.name,
    type: f.type,
    required: required.has(f.name),
    section: f.section ?? null,
    description: f.description,
    ...(f.display_label !== undefined ? { display_label: f.display_label } : {}),
    default: f.default ?? null,
    default_value_rationale: f.default_value_rationale ?? null,
    ...(f.items ? { items: mapFields(f.items, []) } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Main listing function
// ---------------------------------------------------------------------------

export function listTemplateItems(): TemplateListItem[] {
  const items: TemplateListItem[] = [];

  for (const entry of listTemplateEntries()) {
    try {
      const meta = loadMetadata(entry.dir);
      items.push({
        name: entry.id,
        display_name: meta.name,
        category: meta.category ?? categoryFromId(entry.id),
        description: meta.description ?? meta.name,
        license: meta.license,
        source_url: meta.source_url,
        source: sourceName(meta.source_url),
        attribution_text: meta.attribution_text,
        allow_derivatives: meta.allow_derivatives,
        fields: mapFields(meta.fields, meta.priority_fields),
      });
    } catch {
      // Skip templates that fail to load
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

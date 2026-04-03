import MiniSearch from 'minisearch';
import { load } from 'js-yaml';
import { ANALYSIS_DOCUMENTS_DIR } from './constants.js';
import { createProvider } from './filesystem-provider.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentAnalysis } from './analysis-types.js';

interface SearchDocument {
  id: string;
  path: string;
  summary: string;
  parties: string;
  clause_texts: string;
  document_type: string;
  governing_law: string;
}

export interface SearchResult {
  path: string;
  score: number;
  document_type: string | null;
  parties: string[];
  summary: string;
  governing_law?: string;
  effective_date?: string;
  expiration_date?: string;
  status?: string;
  auto_renewal?: boolean;
}

/**
 * Build an in-memory MiniSearch index from all sidecar files.
 * No persistence — rebuilt per query.
 */
function buildSearchIndex(rootDir: string, provider: WorkspaceProvider): { index: MiniSearch<SearchDocument>; sidecars: Map<string, DocumentAnalysis> } {
  const index = new MiniSearch<SearchDocument>({
    fields: ['summary', 'parties', 'clause_texts', 'document_type', 'governing_law'],
    storeFields: ['path'],
    searchOptions: {
      boost: { summary: 2, parties: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  });

  const sidecars = new Map<string, DocumentAnalysis>();

  if (!provider.exists(ANALYSIS_DOCUMENTS_DIR)) {
    return { index, sidecars };
  }

  const files = provider.walk(ANALYSIS_DOCUMENTS_DIR);
  for (const file of files) {
    if (!file.name.endsWith('.contract.yaml')) continue;

    const text = provider.readTextFile(file.relativePath);
    const sidecar = load(text) as DocumentAnalysis;
    if (!sidecar?.document_path) continue;

    sidecars.set(sidecar.document_path, sidecar);

    const clauseTexts = (sidecar.extractions ?? [])
      .filter((e) => e.found)
      .map((e) => [e.clause.replace(/-/g, ' '), e.text ?? ''].join(' '))
      .join(' ');

    index.add({
      id: sidecar.document_path,
      path: sidecar.document_path,
      summary: sidecar.classification?.summary ?? '',
      parties: (sidecar.classification?.parties ?? []).join(' '),
      clause_texts: clauseTexts,
      document_type: sidecar.classification?.document_type ?? '',
      governing_law: sidecar.classification?.governing_law ?? '',
    });
  }

  return { index, sidecars };
}

export interface SearchContractsOptions {
  query?: string;
  document_type?: string;
  party?: string;
  expiring_before?: string;
  stale?: boolean;
  indexed?: boolean;
}

/**
 * Search contracts using BM25 full-text search and/or metadata filters.
 * Index is built in-memory from sidecar files on each call.
 */
export function searchContracts(
  rootDir: string,
  options: SearchContractsOptions,
  allDocuments: Array<{ path: string; analyzed?: boolean; stale?: boolean }>,
  provider?: WorkspaceProvider,
): SearchResult[] {
  const p = provider ?? createProvider(rootDir);
  const { index, sidecars } = buildSearchIndex(rootDir, p);

  let resultPaths: string[];
  const scoreMap = new Map<string, number>();

  if (options.query) {
    const searchResults = index.search(options.query);
    for (const r of searchResults) {
      scoreMap.set(r.id, r.score);
    }
    resultPaths = searchResults.map((r) => r.id);
  } else {
    resultPaths = [...sidecars.keys()];
  }

  let results: SearchResult[] = resultPaths
    .flatMap((path) => {
      const sidecar = sidecars.get(path);
      if (!sidecar) return [];
      const result: SearchResult = {
        path,
        score: scoreMap.get(path) ?? 0,
        document_type: sidecar.classification?.document_type ?? null,
        parties: sidecar.classification?.parties ?? [],
        summary: sidecar.classification?.summary ?? '',
        governing_law: sidecar.classification?.governing_law,
        effective_date: sidecar.classification?.effective_date,
        expiration_date: sidecar.classification?.expiration_date,
        status: sidecar.classification?.status,
        auto_renewal: sidecar.classification?.auto_renewal,
      };
      return [result];
    });

  // Apply metadata filters
  if (options.document_type) {
    results = results.filter((r) => r.document_type === options.document_type);
  }

  if (options.party) {
    const partyLower = options.party.toLowerCase();
    results = results.filter((r) =>
      r.parties.some((p) => p.toLowerCase().includes(partyLower)),
    );
  }

  if (options.expiring_before) {
    const cutoff = options.expiring_before;
    results = results.filter((r) => r.expiration_date && r.expiration_date <= cutoff);
  }

  if (options.indexed !== undefined) {
    const indexedPaths = new Set(sidecars.keys());
    if (options.indexed) {
      results = results.filter((r) => indexedPaths.has(r.path));
    } else {
      // For unindexed, return docs NOT in sidecars
      const unindexed = allDocuments
        .filter((d) => !indexedPaths.has(d.path))
        .map((d) => ({
          path: d.path, score: 0, document_type: null,
          parties: [], summary: '', governing_law: undefined,
          effective_date: undefined, expiration_date: undefined,
        }));
      return unindexed;
    }
  }

  if (options.stale !== undefined) {
    const docMap = new Map(allDocuments.map((d) => [d.path, d]));
    results = results.filter((r) => {
      const doc = docMap.get(r.path);
      return doc?.stale === options.stale;
    });
  }

  return results;
}

/** Format search results as a Markdown table. */
export function formatResultsAsMarkdown(results: SearchResult[]): string {
  if (results.length === 0) return 'No contracts found.';

  const lines: string[] = [
    '| Path | Type | Parties | Expires | Summary |',
    '|------|------|---------|---------|---------|',
  ];

  for (const r of results) {
    const type = r.document_type ?? '—';
    const parties = r.parties.length > 0 ? r.parties.join(', ') : '—';
    const expires = r.expiration_date ?? '—';
    const summary = r.summary.length > 80 ? r.summary.slice(0, 77) + '...' : r.summary || '—';
    lines.push(`| ${escapeMd(r.path)} | ${escapeMd(type)} | ${escapeMd(parties)} | ${escapeMd(expires)} | ${escapeMd(summary)} |`);
  }

  return lines.join('\n');
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

const CSV_COLUMNS = ['path', 'document_type', 'parties', 'effective_date', 'expiration_date', 'status', 'auto_renewal', 'governing_law', 'summary'] as const;

/** Format search results as RFC 4180 CSV with formula-injection hardening. */
export function formatResultsAsCsv(results: SearchResult[]): string {
  const lines: string[] = [CSV_COLUMNS.join(',')];

  for (const r of results) {
    const row = [
      r.path,
      r.document_type ?? '',
      r.parties.join('; '),
      r.effective_date ?? '',
      r.expiration_date ?? '',
      r.status ?? '',
      r.auto_renewal !== undefined ? String(r.auto_renewal) : '',
      r.governing_law ?? '',
      r.summary,
    ].map(csvEscape);
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function csvEscape(value: string): string {
  // Formula injection hardening
  if (/^[=+\-@]/.test(value)) {
    value = `'${value}`;
  }
  // RFC 4180: quote if contains comma, quote, or newline
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

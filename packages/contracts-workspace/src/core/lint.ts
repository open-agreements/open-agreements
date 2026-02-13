import { INDEX_FILE, LIFECYCLE_DIRS } from './constants.js';
import { loadConventions } from './convention-config.js';
import { createProvider } from './filesystem-provider.js';
import { collectWorkspaceDocuments, hasExecutedMarker } from './indexer.js';
import type { WorkspaceProvider } from './provider.js';
import type { LintFinding, LintReport } from './types.js';

export function lintWorkspace(rootDir: string, provider?: WorkspaceProvider): LintReport {
  const p = provider ?? createProvider(rootDir);
  const findings: LintFinding[] = [];

  const conventions = loadConventions(p);
  const markerPattern = conventions.executed_marker.pattern;

  for (const lifecycle of LIFECYCLE_DIRS) {
    if (!p.exists(lifecycle)) {
      findings.push({
        code: 'missing-directory',
        severity: 'error',
        message: `Required lifecycle directory is missing: ${lifecycle}/`,
        path: `${lifecycle}/`,
      });
    }
  }

  const documents = collectWorkspaceDocuments(rootDir, p);
  for (const document of documents) {
    if (document.lifecycle === 'forms' && document.extension === 'pdf') {
      findings.push({
        code: 'disallowed-file-type',
        severity: 'error',
        message: 'PDF files are not allowed in forms/. Move this file to executed/ or archive/.',
        path: document.path,
      });
    }

    // Use convention-configured marker pattern
    const fileHasMarker = hasExecutedMarker(document.file_name, markerPattern);

    if (document.lifecycle === 'executed' && !fileHasMarker) {
      findings.push({
        code: 'missing-executed-marker',
        severity: 'warning',
        message: `File in executed/ is missing ${markerPattern} marker in filename.`,
        path: document.path,
      });
    }

    if (
      (document.lifecycle === 'forms' || document.lifecycle === 'drafts' || document.lifecycle === 'incoming')
      && fileHasMarker
    ) {
      findings.push({
        code: 'executed-marker-outside-executed',
        severity: 'warning',
        message: 'Executed marker detected outside executed/ or archive/.',
        path: document.path,
      });
    }
  }

  findings.push(...detectStaleIndex(p, documents));

  return {
    findings,
    errorCount: findings.filter((finding) => finding.severity === 'error').length,
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
  };
}

function detectStaleIndex(provider: WorkspaceProvider, documents: ReturnType<typeof collectWorkspaceDocuments>): LintFinding[] {
  if (!provider.exists(INDEX_FILE)) {
    return [
      {
        code: 'missing-index',
        severity: 'warning',
        message: `${INDEX_FILE} not found. Run status generate to create it.`,
        path: INDEX_FILE,
      },
    ];
  }

  const indexMtime = provider.stat(INDEX_FILE).mtime.getTime();
  const latestDocumentMtime = documents.reduce((latest, doc) => {
    const mtime = new Date(doc.updated_at).getTime();
    return mtime > latest ? mtime : latest;
  }, 0);

  if (latestDocumentMtime > indexMtime) {
    return [
      {
        code: 'stale-index',
        severity: 'warning',
        message: `${INDEX_FILE} is older than workspace files. Regenerate with status generate.`,
        path: INDEX_FILE,
      },
    ];
  }

  return [];
}

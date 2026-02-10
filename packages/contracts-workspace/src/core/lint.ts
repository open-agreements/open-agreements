import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { INDEX_FILE, LIFECYCLE_DIRS } from './constants.js';
import { collectWorkspaceDocuments } from './indexer.js';
import type { LintFinding, LintReport } from './types.js';

export function lintWorkspace(rootDir: string): LintReport {
  const findings: LintFinding[] = [];

  for (const lifecycle of LIFECYCLE_DIRS) {
    const folderPath = join(rootDir, lifecycle);
    if (!existsSync(folderPath)) {
      findings.push({
        code: 'missing-directory',
        severity: 'error',
        message: `Required lifecycle directory is missing: ${lifecycle}/`,
        path: `${lifecycle}/`,
      });
    }
  }

  const documents = collectWorkspaceDocuments(rootDir);
  for (const document of documents) {
    if (document.lifecycle === 'forms' && document.extension === 'pdf') {
      findings.push({
        code: 'disallowed-file-type',
        severity: 'error',
        message: 'PDF files are not allowed in forms/. Move this file to executed/ or archive/.',
        path: document.path,
      });
    }

    if (document.lifecycle === 'executed' && !document.executed) {
      findings.push({
        code: 'missing-executed-marker',
        severity: 'warning',
        message: 'File in executed/ is missing _executed suffix in filename.',
        path: document.path,
      });
    }

    if (
      (document.lifecycle === 'forms' || document.lifecycle === 'drafts' || document.lifecycle === 'incoming')
      && document.executed
    ) {
      findings.push({
        code: 'executed-marker-outside-executed',
        severity: 'warning',
        message: 'Executed marker detected outside executed/ or archive/.',
        path: document.path,
      });
    }
  }

  findings.push(...detectStaleIndex(rootDir, documents));

  return {
    findings,
    errorCount: findings.filter((finding) => finding.severity === 'error').length,
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
  };
}

function detectStaleIndex(rootDir: string, documents: ReturnType<typeof collectWorkspaceDocuments>): LintFinding[] {
  const indexPath = join(rootDir, INDEX_FILE);
  if (!existsSync(indexPath)) {
    return [
      {
        code: 'missing-index',
        severity: 'warning',
        message: `${INDEX_FILE} not found. Run status generate to create it.`,
        path: INDEX_FILE,
      },
    ];
  }

  const indexMtime = statSync(indexPath).mtimeMs;
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

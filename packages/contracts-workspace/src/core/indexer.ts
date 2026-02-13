import { dump } from 'js-yaml';
import { EXECUTED_SUFFIX, PARTIALLY_EXECUTED_SUFFIX, INDEX_FILE, LIFECYCLE_DIRS, type LifecycleDir } from './constants.js';
import { loadConventions } from './convention-config.js';
import { createProvider } from './filesystem-provider.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentRecord, LintReport, StatusIndex } from './types.js';

export function hasPartiallyExecutedMarker(fileName: string, pattern = PARTIALLY_EXECUTED_SUFFIX): boolean {
  const withoutExtension = fileName.replace(/\.[^.]*$/u, '');
  return withoutExtension.toLowerCase().endsWith(pattern.toLowerCase());
}

export function hasExecutedMarker(fileName: string, pattern = EXECUTED_SUFFIX): boolean {
  const withoutExtension = fileName.replace(/\.[^.]*$/u, '');
  // Check partially_executed first since '_partially_executed' ends with '_executed'
  if (hasPartiallyExecutedMarker(fileName)) {
    return false;
  }
  return withoutExtension.toLowerCase().endsWith(pattern);
}

export function collectWorkspaceDocuments(rootDir: string, provider?: WorkspaceProvider): DocumentRecord[] {
  const p = provider ?? createProvider(rootDir);
  const records: DocumentRecord[] = [];

  // Exclude workspace documentation files from indexing
  const conventions = loadConventions(p);
  const excludedNames = new Set([
    conventions.documentation.root_file,
    conventions.documentation.folder_file,
  ]);

  for (const lifecycle of LIFECYCLE_DIRS) {
    const fileInfos = p.walk(lifecycle);

    for (const info of fileInfos) {
      const fileName = info.name;
      if (excludedNames.has(fileName)) continue;
      const extension = fileName.includes('.')
        ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
        : '';
      const pathParts = info.relativePath.split('/');
      const topic = lifecycle === 'forms'
        ? pathParts[1] || undefined
        : undefined;
      const partialMarkerPattern = conventions.executed_marker.partially_executed_marker?.pattern ?? PARTIALLY_EXECUTED_SUFFIX;
      const partiallyExecuted = hasPartiallyExecutedMarker(fileName, partialMarkerPattern);
      const executed = partiallyExecuted ? false : hasExecutedMarker(fileName);
      const status = executed ? 'executed' : partiallyExecuted ? 'partially_executed' : 'pending';

      records.push({
        path: info.relativePath,
        file_name: fileName,
        extension,
        lifecycle,
        topic,
        executed,
        partially_executed: partiallyExecuted,
        status,
        updated_at: info.mtime.toISOString(),
      });
    }
  }

  records.sort((a, b) => a.path.localeCompare(b.path));
  return records;
}

export function buildStatusIndex(rootDir: string, documents: DocumentRecord[], lint: LintReport): StatusIndex {
  const byLifecycle = Object.fromEntries(
    LIFECYCLE_DIRS.map((lifecycle) => [lifecycle, 0])
  ) as Record<LifecycleDir, number>;

  for (const document of documents) {
    byLifecycle[document.lifecycle] += 1;
  }

  const executedCount = documents.filter((doc) => doc.executed).length;
  const partiallyExecutedCount = documents.filter((doc) => doc.partially_executed).length;

  return {
    generated_at: new Date().toISOString(),
    workspace_root: rootDir,
    summary: {
      total_documents: documents.length,
      executed_documents: executedCount,
      partially_executed_documents: partiallyExecutedCount,
      pending_documents: documents.length - executedCount - partiallyExecutedCount,
      by_lifecycle: byLifecycle,
    },
    documents,
    lint: {
      error_count: lint.errorCount,
      warning_count: lint.warningCount,
      findings: lint.findings,
    },
  };
}

export function writeStatusIndex(
  rootDir: string,
  index: StatusIndex,
  outputPath = INDEX_FILE,
  provider?: WorkspaceProvider
): string {
  const p = provider ?? createProvider(rootDir);
  const yaml = dump(index, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false,
  });
  p.writeFile(outputPath, yaml);
  return `${rootDir}/${outputPath}`;
}

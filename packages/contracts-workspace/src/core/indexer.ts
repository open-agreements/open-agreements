import { dump } from 'js-yaml';
import { EXECUTED_SUFFIX, INDEX_FILE, LIFECYCLE_DIRS, type LifecycleDir } from './constants.js';
import { loadConventions } from './convention-config.js';
import { createProvider } from './filesystem-provider.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentRecord, LintReport, StatusIndex } from './types.js';

export function hasExecutedMarker(fileName: string, pattern = EXECUTED_SUFFIX): boolean {
  const withoutExtension = fileName.replace(/\.[^.]*$/u, '');
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
      const executed = hasExecutedMarker(fileName);

      records.push({
        path: info.relativePath,
        file_name: fileName,
        extension,
        lifecycle,
        topic,
        executed,
        status: executed ? 'executed' : 'pending',
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

  return {
    generated_at: new Date().toISOString(),
    workspace_root: rootDir,
    summary: {
      total_documents: documents.length,
      executed_documents: executedCount,
      pending_documents: documents.length - executedCount,
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

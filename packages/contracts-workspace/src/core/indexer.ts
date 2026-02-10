import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dump } from 'js-yaml';
import { EXECUTED_SUFFIX, INDEX_FILE, LIFECYCLE_DIRS, type LifecycleDir } from './constants.js';
import type { DocumentRecord, LintReport, StatusIndex } from './types.js';

export function hasExecutedMarker(fileName: string): boolean {
  const withoutExtension = fileName.replace(/\.[^.]*$/u, '');
  return withoutExtension.toLowerCase().endsWith(EXECUTED_SUFFIX);
}

export function collectWorkspaceDocuments(rootDir: string): DocumentRecord[] {
  const records: DocumentRecord[] = [];

  for (const lifecycle of LIFECYCLE_DIRS) {
    const lifecyclePath = join(rootDir, lifecycle);
    const filePaths = walkFiles(lifecyclePath);

    for (const filePath of filePaths) {
      const relativePath = relative(rootDir, filePath).replaceAll('\\\\', '/');
      const fileName = relativePath.split('/').at(-1) ?? '';
      const extension = fileName.includes('.')
        ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
        : '';
      const topic = lifecycle === 'forms'
        ? relativePath.split('/')[1] || undefined
        : undefined;
      const stats = statSync(filePath);
      const executed = hasExecutedMarker(fileName);

      records.push({
        path: relativePath,
        file_name: fileName,
        extension,
        lifecycle,
        topic,
        executed,
        status: executed ? 'executed' : 'pending',
        updated_at: stats.mtime.toISOString(),
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

export function writeStatusIndex(rootDir: string, index: StatusIndex, outputPath = INDEX_FILE): string {
  const path = join(rootDir, outputPath);
  const yaml = dump(index, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false,
  });
  writeFileSync(path, yaml, 'utf-8');
  return path;
}

function walkFiles(directoryPath: string): string[] {
  try {
    const entries = readdirSync(directoryPath, { withFileTypes: true });
    const output: string[] = [];

    for (const entry of entries) {
      const fullPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        output.push(...walkFiles(fullPath));
      } else if (entry.isFile()) {
        output.push(fullPath);
      }
    }

    return output;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

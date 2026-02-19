import { CONTRACTS_GUIDE_FILE, CATALOG_FILE, INDEX_FILE, LIFECYCLE_DIRS } from './constants.js';
import { loadConventions } from './convention-config.js';
import { createProvider } from './filesystem-provider.js';
import { collectWorkspaceDocuments, hasExecutedMarker, hasPartiallyExecutedMarker } from './indexer.js';
import type { WorkspaceProvider } from './provider.js';
import type { ConventionConfig, LintFinding, LintReport } from './types.js';

export function lintWorkspace(rootDir: string, provider?: WorkspaceProvider): LintReport {
  const p = provider ?? createProvider(rootDir);
  const findings: LintFinding[] = [];

  const conventions = loadConventions(p);
  const markerPattern = conventions.executed_marker.pattern;

  for (const lifecycle of LIFECYCLE_DIRS) {
    if (!p.exists(lifecycle)) {
      findings.push({
        code: 'missing-directory',
        severity: 'warning',
        message: `Lifecycle directory not found: ${lifecycle}/. Consider creating it to organize documents.`,
        path: `${lifecycle}/`,
      });
    }
  }

  const disallowedMap = conventions.disallowed_file_types ?? { forms: ['pdf'] };

  const documents = collectWorkspaceDocuments(rootDir, p);
  for (const document of documents) {
    if (document.lifecycle) {
      const disallowed = disallowedMap[document.lifecycle];
      if (disallowed && disallowed.includes(document.extension)) {
        findings.push({
          code: 'disallowed-file-type',
          severity: 'error',
          message: `${document.extension.toUpperCase()} files are not allowed in ${document.lifecycle}/. Move this file to executed/ or archive/.`,
          path: document.path,
        });
      }
    }

    // Use convention-configured marker pattern
    const fileHasMarker = hasExecutedMarker(document.file_name, markerPattern);
    const fileHasPartialMarker = document.partially_executed;

    if (document.lifecycle === 'executed' && !fileHasMarker && !fileHasPartialMarker) {
      findings.push({
        code: 'missing-executed-marker',
        severity: 'warning',
        message: `File in executed/ is missing ${markerPattern} marker in filename.`,
        path: document.path,
      });
    }

    if (
      (document.lifecycle === 'forms' || document.lifecycle === 'drafts' || document.lifecycle === 'incoming')
      && (fileHasMarker || fileHasPartialMarker)
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
  findings.push(...detectDuplicateFiles(documents));
  findings.push(...detectRootOrphans(p, conventions));
  findings.push(...detectCrossContamination(p, conventions));

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

// --- duplicate-file ---

const COPY_TIMESTAMP_PATTERNS = [
  / \(\d+\)$/u,                              // " (1)", " (2)"
  / - Copy$/iu,                               // " - Copy"
  / - \d{4}-\d{2}-\d{2},? \d{1,2}:\d{2} [AP]M$/iu,  // " - 2024-01-15, 3:42 PM"
  / - \d{4}-\d{2}-\d{2}$/u,                  // " - 2024-01-15"
  / copy$/iu,                                  // " copy"
];

function normalizeForDuplicateCheck(fileName: string): string {
  const extIdx = fileName.lastIndexOf('.');
  const ext = extIdx > 0 ? fileName.slice(extIdx) : '';
  let stem = extIdx > 0 ? fileName.slice(0, extIdx) : fileName;

  for (const pattern of COPY_TIMESTAMP_PATTERNS) {
    stem = stem.replace(pattern, '');
  }

  return (stem + ext).toLowerCase();
}

function detectDuplicateFiles(documents: ReturnType<typeof collectWorkspaceDocuments>): LintFinding[] {
  const findings: LintFinding[] = [];
  const groups = new Map<string, typeof documents>();

  for (const doc of documents) {
    const key = `${doc.lifecycle}/${normalizeForDuplicateCheck(doc.file_name)}`;
    const group = groups.get(key);
    if (group) {
      group.push(doc);
    } else {
      groups.set(key, [doc]);
    }
  }

  for (const [, group] of groups) {
    if (group.length > 1) {
      for (const doc of group) {
        findings.push({
          code: 'duplicate-file',
          severity: 'warning',
          message: `File appears to be a duplicate or timestamped copy. ${group.length} files share the same normalized name.`,
          path: doc.path,
        });
      }
    }
  }

  return findings;
}

// --- root-orphan ---

const ROOT_CONFIG_FILES = new Set([
  CONTRACTS_GUIDE_FILE,
  'WORKSPACE.md',
  CATALOG_FILE,
  INDEX_FILE,
  '.gitignore',
  '.gitkeep',
]);

function detectRootOrphans(provider: WorkspaceProvider, conventions: ConventionConfig): LintFinding[] {
  const findings: LintFinding[] = [];
  const docFile = conventions.documentation.root_file;

  try {
    const rootEntries = provider.readdir('.');
    for (const entry of rootEntries) {
      if (entry.isDirectory) continue;
      if (ROOT_CONFIG_FILES.has(entry.name)) continue;
      if (entry.name === docFile) continue;
      if (entry.name.startsWith('.')) continue;

      findings.push({
        code: 'root-orphan',
        severity: 'warning',
        message: 'File at workspace root is not in a lifecycle folder. Consider moving to drafts/ or incoming/.',
        path: entry.name,
      });
    }
  } catch {
    // readdir may fail on empty/nonexistent root
  }

  return findings;
}

// --- cross-contamination ---
//
// This rule is intentionally conservative. It only flags files whose
// names contain compound phrases that unambiguously identify a domain —
// single generic words like "policy", "agreement", or "invoice" appear
// across too many folders to be useful signals.

const DOMAIN_PHRASE_MAP: [RegExp, string[]][] = [
  [/\boffer.?letter\b/iu, ['Employment', 'HR', 'People', 'Employment and Human Resources']],
  [/\bip.?assignment\b/iu, ['IP', 'Intellectual Property']],
  [/\bstock.?purchase\b/iu, ['Equity Documents', 'Corporate']],
  [/\bboard.?meeting.?minutes\b/iu, ['Board Meetings', 'Corporate Governance']],
  [/\bpenetration.?test/iu, ['Security', 'IT Security']],
  [/\bdata.?processing.?agreement\b/iu, ['Compliance', 'Policies']],
];

function detectCrossContamination(provider: WorkspaceProvider, conventions: ConventionConfig): LintFinding[] {
  const findings: LintFinding[] = [];
  const lifecycleDirSet = new Set(LIFECYCLE_DIRS as readonly string[]);
  const applicableDomains = conventions.lifecycle.applicable_domains;

  // Only run when applicable_domains are configured and include non-lifecycle folders
  const domainFolders = applicableDomains.filter((d) => !lifecycleDirSet.has(d));
  if (domainFolders.length === 0) return findings;

  for (const folder of domainFolders) {
    let files: { name: string; relativePath: string }[];
    try {
      files = provider.walk(folder);
    } catch {
      continue;
    }

    for (const file of files) {
      const fileName = file.name.toLowerCase();

      for (const [pattern, expectedDomains] of DOMAIN_PHRASE_MAP) {
        if (pattern.test(fileName)) {
          const currentFolderLower = folder.toLowerCase();
          const isExpected = expectedDomains.some((d) => d.toLowerCase() === currentFolderLower);
          if (!isExpected) {
            findings.push({
              code: 'cross-contamination',
              severity: 'warning',
              message: `File may belong in ${expectedDomains[0]}/ rather than ${folder}/.`,
              path: file.relativePath,
            });
            break;
          }
        }
      }
    }
  }

  return findings;
}

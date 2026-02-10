import type { LifecycleDir } from './constants.js';

export type AgentName = 'claude' | 'gemini';

export interface InitWorkspaceOptions {
  agents?: AgentName[];
  topics?: string[];
}

export interface InitWorkspaceResult {
  rootDir: string;
  createdDirectories: string[];
  existingDirectories: string[];
  createdFiles: string[];
  existingFiles: string[];
  agentInstructions: string[];
}

export interface LintFinding {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

export interface LintReport {
  findings: LintFinding[];
  errorCount: number;
  warningCount: number;
}

export interface DocumentRecord {
  path: string;
  file_name: string;
  extension: string;
  lifecycle: LifecycleDir;
  topic?: string;
  executed: boolean;
  status: 'executed' | 'pending';
  updated_at: string;
}

export interface StatusIndex {
  generated_at: string;
  workspace_root: string;
  summary: {
    total_documents: number;
    executed_documents: number;
    pending_documents: number;
    by_lifecycle: Record<LifecycleDir, number>;
  };
  documents: DocumentRecord[];
  lint: {
    error_count: number;
    warning_count: number;
    findings: LintFinding[];
  };
}

export interface CatalogEntry {
  id: string;
  name: string;
  source_url: string;
  checksum: {
    sha256: string;
  };
  license: {
    type: string;
    redistribution: 'allowed-unmodified' | 'pointer-only';
  };
  destination_lifecycle?: LifecycleDir;
  destination_topic?: string;
  destination_filename?: string;
  notes?: string;
}

export interface FormsCatalog {
  schema_version: 1;
  generated_at?: string;
  entries: CatalogEntry[];
}

export interface FetchResult {
  id: string;
  status: 'downloaded' | 'pointer-only' | 'failed';
  path?: string;
  message: string;
}

export interface FetchSummary {
  results: FetchResult[];
  downloadedCount: number;
  pointerOnlyCount: number;
  failedCount: number;
}

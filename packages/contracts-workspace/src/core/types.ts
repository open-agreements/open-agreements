import type { LifecycleDir } from './constants.js';
import type { DocumentType } from './analysis-types.js';

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

export interface InitWorkspacePlanResult {
  rootDir: string;
  suggestedDirectories: string[];
  existingDirectories: string[];
  missingDirectories: string[];
  suggestedFiles: string[];
  existingFiles: string[];
  missingFiles: string[];
  agentInstructions: string[];
  suggestedCommands: string[];
  lint: LintReport;
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
  lifecycle?: LifecycleDir;
  topic?: string;
  executed: boolean;
  partially_executed: boolean;
  status: 'executed' | 'partially_executed' | 'pending';
  updated_at: string;
  classification?: {
    document_type: DocumentType | null;
    parties: string[];
    summary: string;
  };
  analyzed?: boolean;
  stale?: boolean;
}

export interface AnalysisSummary {
  analyzed_documents: number;
  unanalyzed_documents: number;
  stale_documents: number;
  orphaned_sidecars: number;
  by_document_type: Record<string, number>;
  expiring_soon: Array<{ path: string; expiration_date: string; document_type: string }>;
}

export interface StatusIndex {
  generated_at: string;
  workspace_root: string;
  summary: {
    total_documents: number;
    executed_documents: number;
    partially_executed_documents: number;
    pending_documents: number;
    by_lifecycle: Record<LifecycleDir, number>;
  };
  documents: DocumentRecord[];
  lint: {
    error_count: number;
    warning_count: number;
    findings: LintFinding[];
  };
  analysis?: AnalysisSummary;
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

export interface ConventionConfig {
  schema_version: 1;
  executed_marker: {
    pattern: string;
    location: 'before_extension' | 'in_parentheses' | 'custom';
    partially_executed_marker?: {
      pattern: string;
      location: 'before_extension' | 'in_parentheses' | 'custom';
    };
  };
  naming: {
    style: string;
    separator: string;
    date_format: string;
  };
  lifecycle: {
    folders: Record<string, string>;
    applicable_domains: string[];
    asset_domains: string[];
  };
  disallowed_file_types?: Record<string, string[]>;
  cross_references: {
    policy: string;
    mechanism: string;
  };
  documentation: {
    root_file: string;
    folder_file: string;
  };
}

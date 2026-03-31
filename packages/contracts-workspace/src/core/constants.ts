export const LIFECYCLE_DIRS = [
  'forms',
  'drafts',
  'incoming',
  'executed',
  'archive',
] as const;

export type LifecycleDir = (typeof LIFECYCLE_DIRS)[number];

export const DEFAULT_FORM_TOPICS = [
  'corporate',
  'commercial',
  'employment',
  'finance',
  'tax',
  'compliance',
] as const;

export const CONTRACTS_GUIDE_FILE = 'CONTRACTS.md';
export const CATALOG_FILE = 'forms-catalog.yaml';
export const INDEX_FILE = 'contracts-index.yaml';
export const INTERNAL_DIR = '.contracts-workspace';
export const AGENT_SETUP_DIR = '.contracts-workspace/agents';

export const ANALYSIS_DIR = `${INTERNAL_DIR}/analysis`;
export const ANALYSIS_DOCUMENTS_DIR = `${ANALYSIS_DIR}/documents`;
export const CONFIG_FILE = `${INTERNAL_DIR}/config.yaml`;

export const IGNORED_DIRS = new Set([
  INTERNAL_DIR, '.git', '.claude', '.agents',
  '.gemini', 'node_modules', '.vscode', '.idea',
]);

export const DOCUMENT_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'txt', 'rtf', 'md', 'xlsx', 'pptx',
]);

// These values are defaults. Runtime behavior reads from convention config.
export const EXECUTED_SUFFIX = '_executed';
export const PARTIALLY_EXECUTED_SUFFIX = '_partially_executed';

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

// These values are defaults. Runtime behavior reads from convention config.
export const EXECUTED_SUFFIX = '_executed';

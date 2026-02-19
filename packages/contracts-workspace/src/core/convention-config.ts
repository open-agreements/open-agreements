import { dump, load } from 'js-yaml';
import { z } from 'zod';
import { INTERNAL_DIR } from './constants.js';
import type { WorkspaceProvider } from './provider.js';
import type { ConventionConfig } from './types.js';

const CONVENTIONS_PATH = `${INTERNAL_DIR}/conventions.yaml`;

export const ConventionConfigSchema = z.object({
  schema_version: z.literal(1),
  executed_marker: z.object({
    pattern: z.string().min(1),
    location: z.enum(['before_extension', 'in_parentheses', 'custom']),
    partially_executed_marker: z.object({
      pattern: z.string().min(1),
      location: z.enum(['before_extension', 'in_parentheses', 'custom']),
    }).optional(),
  }),
  naming: z.object({
    style: z.string().min(1),
    separator: z.string(),
    date_format: z.string().min(1),
  }),
  lifecycle: z.object({
    folders: z.record(z.string(), z.string()),
    applicable_domains: z.array(z.string()),
    asset_domains: z.array(z.string()),
  }),
  disallowed_file_types: z.record(z.string(), z.array(z.string())).optional().default({ forms: ['pdf'] }),
  cross_references: z.object({
    policy: z.string(),
    mechanism: z.string(),
  }),
  documentation: z.object({
    root_file: z.string().min(1),
    folder_file: z.string().min(1),
  }),
});

export function defaultConventions(): ConventionConfig {
  return {
    schema_version: 1,
    executed_marker: {
      pattern: '_executed',
      location: 'before_extension',
      partially_executed_marker: {
        pattern: '_partially_executed',
        location: 'before_extension',
      },
    },
    naming: {
      style: 'snake_case',
      separator: '_',
      date_format: 'YYYY-MM-DD',
    },
    lifecycle: {
      folders: {
        forms: 'forms',
        drafts: 'drafts',
        incoming: 'incoming',
        executed: 'executed',
        archive: 'archive',
      },
      applicable_domains: ['forms', 'drafts', 'incoming', 'executed', 'archive'],
      asset_domains: [],
    },
    cross_references: {
      policy: 'warn',
      mechanism: 'filename',
    },
    documentation: {
      root_file: 'WORKSPACE.md',
      folder_file: 'FOLDER.md',
    },
  };
}

export function loadConventions(provider: WorkspaceProvider): ConventionConfig {
  try {
    const raw = provider.readTextFile(CONVENTIONS_PATH);
    const parsed = load(raw);
    return ConventionConfigSchema.parse(parsed);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return defaultConventions();
    }
    throw error;
  }
}

export function writeConventions(provider: WorkspaceProvider, config: ConventionConfig): void {
  provider.mkdir(INTERNAL_DIR, { recursive: true });
  const yaml = dump(config, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false,
  });
  provider.writeFile(CONVENTIONS_PATH, yaml);
}

export function conventionsPath(): string {
  return CONVENTIONS_PATH;
}

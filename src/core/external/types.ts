import type { ExternalMetadata } from '../metadata.js';

export interface ExternalFillOptions {
  externalId: string;
  outputPath: string;
  values: Record<string, unknown>;
  keepIntermediate?: boolean;
}

export interface ExternalFillResult {
  outputPath: string;
  metadata: ExternalMetadata;
  fieldsUsed: string[];
  stages: {
    clean: string;
    patch: string;
    fill: string;
  };
}

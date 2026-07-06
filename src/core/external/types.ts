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
  /** Prepared data keys actually referenced by fill commands in the document. */
  fieldsUsed: string[];
  /** Subset of fieldsUsed whose values the caller actually supplied. */
  providedFieldsUsed: string[];
  /** Fill commands found in the final pre-fill document; 0 = nothing was substituted. */
  fillCommandCount: number;
  /** Guardrail warnings (zero-fill-command, verify failures). */
  warnings: string[];
  stages: {
    clean: string;
    patch: string;
    fill: string;
  };
}

import type { FieldSelectorMetadata } from '../metadata.js';
import type { ComputedArtifact } from './computed.js';

export interface FieldSelectorRunOptions {
  fieldSelectorId: string;
  inputPath?: string;
  outputPath: string;
  values: Record<string, unknown>;
  keepIntermediate?: boolean;
  computedOutPath?: string;
  normalizeBracketArtifacts?: boolean;
}

export interface FieldSelectorRunResult {
  outputPath: string;
  metadata: FieldSelectorMetadata;
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
  computedArtifact?: ComputedArtifact;
  computedOutPath?: string;
}

export interface VerifyResult {
  passed: boolean;
  checks: VerifyCheck[];
}

export interface VerifyCheck {
  name: string;
  passed: boolean;
  details?: string;
}

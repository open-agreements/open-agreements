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
  fieldsUsed: string[];
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

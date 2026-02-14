import type { RecipeMetadata } from '../metadata.js';
import type { ComputedArtifact } from './computed.js';

export interface RecipeRunOptions {
  recipeId: string;
  inputPath?: string;
  outputPath: string;
  values: Record<string, string | boolean>;
  keepIntermediate?: boolean;
  computedOutPath?: string;
  normalizeBracketArtifacts?: boolean;
}

export interface RecipeRunResult {
  outputPath: string;
  metadata: RecipeMetadata;
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

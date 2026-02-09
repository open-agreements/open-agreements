import type { RecipeMetadata } from '../metadata.js';

export interface RecipeRunOptions {
  recipeId: string;
  inputPath?: string;
  outputPath: string;
  values: Record<string, string>;
  keepIntermediate?: boolean;
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

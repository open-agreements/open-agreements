// Public API exports

// Template engine
export { fillTemplate, type FillOptions, type FillResult } from './core/engine.js';

// Metadata schemas and loaders
export {
  loadMetadata,
  validateMetadata,
  loadRecipeMetadata,
  validateRecipeMetadata,
  loadCleanConfig,
  TemplateMetadataSchema,
  RecipeMetadataSchema,
  CleanConfigSchema,
  LicenseEnum,
  FieldDefinitionSchema,
  type TemplateMetadata,
  type RecipeMetadata,
  type CleanConfig,
  type FieldDefinition,
  type License,
} from './core/metadata.js';

// External template engine
export {
  runExternalFill,
  type ExternalFillOptions,
  type ExternalFillResult,
} from './core/external/index.js';

// Metadata schemas and loaders (external)
export {
  loadExternalMetadata,
  validateExternalMetadata,
  ExternalMetadataSchema,
  type ExternalMetadata,
} from './core/metadata.js';

// Template validation
export { validateTemplate, type TemplateValidationResult } from './core/validation/template.js';
export { validateLicense, type LicenseValidationResult } from './core/validation/license.js';
export { validateOutput, type OutputValidationResult } from './core/validation/output.js';
export { validateRecipe, type RecipeValidationResult } from './core/validation/recipe.js';
export { validateExternal, type ExternalValidationResult } from './core/validation/external.js';
export {
  assessScanMetadataCoverage,
  type ScanMetadataCoverageInput,
  type ScanMetadataCoverageReport,
} from './core/validation/scan-metadata.js';

// Recipe engine
export {
  runRecipe,
  cleanDocument,
  patchDocument,
  verifyOutput,
  ensureSourceDocx,
  checkRecipeSourceDrift,
  computeSourceStructureSignature,
  type RecipeRunOptions,
  type RecipeRunResult,
  type VerifyResult,
  type VerifyCheck,
} from './core/recipe/index.js';

// Command generation
export type { ToolCommandAdapter } from './core/command-generation/types.js';
export { ClaudeCodeAdapter } from './core/command-generation/adapters/claude.js';

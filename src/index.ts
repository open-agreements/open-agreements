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

// Closing checklist
export {
  buildChecklistTemplateContext,
  ClosingChecklistSchema,
  ChecklistPatchEnvelopeSchema,
  ChecklistPatchApplyRequestSchema,
  ChecklistPatchOperationSchema,
  PatchCitationSchema,
  ChecklistPatchModeEnum,
  JsonPointerSchema,
  CHECKLIST_PATCH_VALIDATION_TTL_MS,
  applyChecklistPatchOperations,
  computeChecklistPatchHash,
  validateChecklistPatch,
  getChecklistPatchValidationArtifact,
  setChecklistPatchValidationStore,
  getChecklistPatchValidationStore,
  applyChecklistPatch,
  setChecklistAppliedPatchStore,
  getChecklistAppliedPatchStore,
  setChecklistProposedPatchStore,
  getChecklistProposedPatchStore,
  type ClosingChecklist,
  type ChecklistPatchEnvelope,
  type ChecklistPatchApplyRequest,
  type ChecklistPatchOperation,
  type PatchCitation,
  type ChecklistPatchMode,
  type JsonPointer,
  type ChecklistPatchValidationErrorCode,
  type ChecklistPatchValidationDiagnostic,
  type ResolvedChecklistPatchOperation,
  type ChecklistPatchValidationArtifact,
  type ChecklistPatchValidationStore,
  type ValidateChecklistPatchInput,
  type ChecklistPatchValidationSuccess,
  type ChecklistPatchValidationFailure,
  type ChecklistPatchValidationResult,
  type ChecklistAppliedPatchRecord,
  type ChecklistAppliedPatchStore,
  type ChecklistProposedPatchRecord,
  type ChecklistProposedPatchStore,
  type ChecklistPatchApplyErrorCode,
  type ChecklistPatchApplyFailure,
  type ChecklistPatchApplySuccess,
  type ChecklistPatchApplyResult,
  type ApplyChecklistPatchInput,
} from './core/checklist/index.js';

export {
  ChecklistStageEnum,
  ChecklistEntryStatusEnum,
  SignatoryStatusEnum,
  ChecklistItemStatusEnum,
  IssueStatusEnum,
  ResponsibilitySchema,
  CitationSchema,
  SignatureArtifactSchema,
  SignatorySchema,
  ChecklistDocumentSchema,
  ChecklistEntrySchema,
  ActionItemSchema,
  IssueSchema,
  type ChecklistStage,
  type ChecklistEntryStatus,
  type SignatoryStatus,
  type ChecklistItemStatus,
  type IssueStatus,
  type Responsibility,
  type Citation,
  type SignatureArtifact,
  type Signatory,
  type ChecklistDocument,
  type ChecklistEntry,
  type ActionItem,
  type Issue,
} from './core/checklist/schemas.js';

// Command generation
export type { ToolCommandAdapter } from './core/command-generation/types.js';
export { ClaudeCodeAdapter } from './core/command-generation/adapters/claude.js';

// Public API exports
export { fillTemplate, type FillOptions, type FillResult } from './core/engine.js';
export {
  loadMetadata,
  validateMetadata,
  TemplateMetadataSchema,
  LicenseEnum,
  FieldDefinitionSchema,
  type TemplateMetadata,
  type FieldDefinition,
  type License,
} from './core/metadata.js';
export { validateTemplate, type TemplateValidationResult } from './core/validation/template.js';
export { validateLicense, type LicenseValidationResult } from './core/validation/license.js';
export { validateOutput, type OutputValidationResult } from './core/validation/output.js';
export type { ToolCommandAdapter } from './core/command-generation/types.js';
export { ClaudeCodeAdapter } from './core/command-generation/adapters/claude.js';

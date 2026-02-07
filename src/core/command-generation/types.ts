import type { TemplateMetadata } from '../metadata.js';

/**
 * Adapter interface for generating agent-specific skill files from template metadata.
 * Implement this interface to support new coding agents (Cursor, Windsurf, etc.).
 */
export interface ToolCommandAdapter {
  /** Unique name for this adapter (e.g., 'claude-code', 'cursor') */
  readonly name: string;

  /** Generate the skill/command file content for this agent */
  generateSkillFile(metadata: TemplateMetadata, templateId: string): string;

  /** Generate the output file path for the skill file */
  getOutputPath(templateId: string): string;
}

---
title: Supported Tools
description: Agent adapters and how to add support for new coding agents.
order: 7
section: Reference
---

# Supported Tools

OpenAgreements uses an agent-agnostic `ToolCommandAdapter` interface for generating skills that work with different coding agents.

## Currently Supported

### Claude Code

- **Skill file**: `.claude/commands/open-agreements.md`
- **How it works**: Claude reads template metadata, interviews the user via `AskUserQuestion`, and invokes the CLI to render the DOCX
- **Usage**: `/open-agreements` in Claude Code

### Cursor

- **Plugin manifest**: `.cursor-plugin/plugin.json`
- **MCP config**: `mcp.json`
- **Skill file**: `skills/open-agreements/SKILL.md`
- **How it works**: Cursor can load OpenAgreements MCP servers from `mcp.json` and use the OpenAgreements skill for guided template filling
- **Publish URL**: `https://cursor.com/marketplace/publish`

### Gemini CLI

- **Extension manifest**: `gemini-extension.json`
- **Context file**: `GEMINI.md`
- **How it works**: Gemini loads two local stdio MCP servers:
  - `@open-agreements/contracts-workspace-mcp` for workspace/catalog/status operations
  - `@open-agreements/contract-templates-mcp` for template discovery and fill workflows

## Adding Support for New Agents

To add support for a new coding agent (e.g., Cursor, Windsurf):

### 1. Implement the ToolCommandAdapter interface

```typescript
import type { ToolCommandAdapter } from '../types.js';
import type { TemplateMetadata } from '../../metadata.js';

export class MyAgentAdapter implements ToolCommandAdapter {
  readonly name = 'my-agent';

  generateSkillFile(metadata: TemplateMetadata, templateId: string): string {
    // Generate the skill/command file content for your agent
    return '...';
  }

  getOutputPath(templateId: string): string {
    // Return the file path where the skill should be written
    return '.my-agent/commands/open-agreements.md';
  }
}
```

### 2. Register the adapter

Add your adapter to `src/core/command-generation/adapters/`.

### 3. Generate the skill file

The adapter's `generateSkillFile` method should produce a file that:

1. Discovers template fields from metadata
2. Interviews the user for field values using the agent's native capabilities
3. Invokes `open-agreements fill` to render the DOCX
4. Reports the output path to the user

## Interface Definition

See `src/core/command-generation/types.ts` for the full `ToolCommandAdapter` interface.

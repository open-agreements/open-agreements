# Change: Add TypeScript MCP Server for Safe Docx

## Why

Anthropic's Claude Desktop bundles Node.js but not Python, making TypeScript MCP servers frictionless to install via `npx`. The current Python implementation requires users to have Python/uv installed or use the `.mcpb` bundle format, which has higher friction. Additionally, Google's Gemini CLI is TypeScript-based, and major competitors (Harvey, Clio) are Python-centric - a TypeScript implementation provides better distribution alignment while raising barriers for direct code reuse by Python-focused competitors.

## What Changes

- **NEW**: TypeScript implementation of Safe Docx MCP server using `@modelcontextprotocol/sdk`
- **NEW**: NPM package `@usejunior/safe-docx` for direct `npx` installation
- **NEW**: TypeScript document primitives layer mirroring Python's atomic operations pattern
- **PRESERVED**: Python implementation remains for internal Junior app use
- **DEPRECATED**: Python `.mcpb` bundle for Anthropic distribution (replaced by NPM)

## Impact

- Affected specs: `mcp-server` (new capability for TS version)
- Affected code:
  - New: `packages/safe-docx-ts/` (TypeScript MCP server)
  - New: `packages/docx-primitives-ts/` (TypeScript document operations)
  - Preserved: `app/mcp_server/` (Python, internal use)
  - Preserved: `app/shared/document_primitives/` (Python, internal use)

## Strategic Rationale

### Distribution Alignment
- Claude Desktop ships with Node.js runtime - zero user installation required
- NPM enables `npx @usejunior/safe-docx` one-liner installation
- Anthropic's official MCP servers are all TypeScript
- Potential future compatibility with Google Gemini CLI extensions

### Competitive Positioning
- Harvey AI's infrastructure is Python-centric; TypeScript creates integration friction
- Open-sourcing TS version provides ecosystem value without directly benefiting Python-native competitors
- Establishes Safe Docx as the reference implementation for AI document editing

### Maintenance Strategy
- **NOT** maintaining parallel implementations long-term
- TypeScript becomes the distribution/community version
- Python remains internal for Junior app integration
- Core algorithms documented such that either can be updated independently

## Success Criteria

1. `npx @usejunior/safe-docx` works out-of-box on macOS/Windows
2. All 7 tools functional: `open_document`, `read_file`, `grep`, `smart_edit`, `smart_insert`, `download`, `get_session_status`
3. Tool annotations (`readOnlyHint`, `destructiveHint`) properly configured
4. Listed in Anthropic MCP directory
5. <500ms cold start time

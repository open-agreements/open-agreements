## 1. Package scaffolding

- [x] 1.1 Create a sibling package under `packages/` for the local contracts-workspace MCP server
- [x] 1.2 Add build and run scripts plus executable bin entrypoint
- [x] 1.3 Wire TypeScript config and exports for local development/testing

## 2. MCP server implementation

- [x] 2.1 Implement stdio MCP server bootstrap and lifecycle handling
- [x] 2.2 Add tool for workspace initialization (lifecycle folders, CONTRACTS.md, agent snippets)
- [x] 2.3 Add tool for catalog validation and return normalized validation output
- [x] 2.4 Add tool for catalog fetch with checksum verification summaries
- [x] 2.5 Add tool for status index generation and lint reporting
- [x] 2.6 Add tool for status lint-only checks
- [x] 2.7 Ensure tools operate on explicit `root_dir` (defaulting to current working directory)

## 3. Testing and docs

- [x] 3.1 Add tests for successful tool calls and structured outputs
- [x] 3.2 Add tests for validation and fetch failure paths
- [x] 3.3 Document local connector setup for Claude Code and Claude Desktop
- [x] 3.4 Add a short local demo flow users can run end-to-end

## 4. Validation

- [x] 4.1 Run `openspec validate add-local-contracts-workspace-mcp --strict`
- [x] 4.2 Run targeted MCP package tests and builds
- [x] 4.3 Run relevant existing workspace tests to confirm no regressions

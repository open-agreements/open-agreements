## 1. Phase 0 — MCP Arg Validation Cleanup
- [x] 1.1 Add `z` import to `api/mcp.ts`
- [x] 1.2 Create `FillTemplateArgsSchema` and `ListTemplatesArgsSchema`
- [x] 1.3 Refactor `handleToolsCall` to use Zod `.safeParse()` for existing tools
- [x] 1.4 Verify existing MCP integration tests still pass

## 2. Schemas
- [x] 2.1 Create `src/core/checklist/schemas.ts` with all Zod schemas
- [x] 2.2 Create `src/core/checklist/schemas.test.ts` with unit tests
- [x] 2.3 Export schemas and types from `src/index.ts`

## 3. Template
- [x] 3.1 Create `content/templates/closing-checklist/template.docx` with loop constructs
- [x] 3.2 Create `content/templates/closing-checklist/metadata.yaml`

## 4. Core Module
- [x] 4.1 Create `src/core/checklist/index.ts` with `renderClosingChecklist()` and `renderChecklistMarkdown()`

## 5. MCP Tool
- [x] 5.1 Add `create_closing_checklist` tool definition to TOOLS array
- [x] 5.2 Add `CreateChecklistArgsSchema` Zod schema
- [x] 5.3 Add handler in `handleToolsCall`
- [x] 5.4 Add `handleCreateChecklist()` to `api/_shared.ts`

## 6. CLI Command
- [x] 6.1 Create `src/commands/checklist.ts`
- [x] 6.2 Register `checklist` command in `src/cli/index.ts`

## 7. Verification
- [x] 7.1 `npm run build` succeeds
- [x] 7.2 Schema tests pass
- [x] 7.3 Full test suite passes
- [x] 7.4 `npm run lint` — fixed checklist-specific lint error (unused ClosingChecklist import); remaining lint errors are pre-existing

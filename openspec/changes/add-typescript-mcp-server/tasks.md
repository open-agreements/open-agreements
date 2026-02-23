# Tasks: TypeScript MCP Server for Safe Docx

## Phase 0: Positioning & Brand Setup

### 0.1 Naming & Positioning
- [x] 0.1.1 Finalize name: "Safe Docx" or "Atomic DOCX Ops"
- [x] 0.1.2 Tagline: "Atomic DOCX operations for AI systems — fast, safe, composable edits that preserve document integrity"
- [ ] 0.1.3 Register trademark if desired (separate from MIT license)

### 0.2 Repository Setup
- [ ] 0.2.1 Create public GitHub repo `usejunior/safe-docx`
- [ ] 0.2.2 Add MIT LICENSE file
- [ ] 0.2.3 Create SECURITY.md with vulnerability reporting process
- [ ] 0.2.4 Create CONTRIBUTING.md with:
  - Signed commits required
  - 2-person review for security-sensitive code
  - DCO (Developer Certificate of Origin)
- [ ] 0.2.5 Configure branch protection rules
- [ ] 0.2.6 Set up GitHub security advisories

## Phase 1: Project Setup

### 1.1 Monorepo Structure
- [x] 1.1.1 Initialize pnpm workspace at `packages/` (npm workspaces, not pnpm)
- [x] 1.1.2 Create `packages/safe-docx-ts/package.json` with MCP dependencies
- [x] 1.1.3 Create `packages/docx-primitives-ts/package.json`
- [x] 1.1.4 Configure TypeScript with strict mode
- [x] 1.1.5 Set up ESLint + Prettier
- [x] 1.1.6 Configure Vitest for testing

### 1.2 BDD/Gherkin Test Infrastructure
> **Rationale**: Use Gherkin .feature files as source of truth for behavior, enabling equivalence testing between Python and TypeScript implementations. Inspired by python-docx's BDD approach.

- [x] 1.2.1 Install cucumber-js and configure for TypeScript (superseded: Allure/Vitest approach used instead)
- [x] 1.2.2 Create `features/` directory at repo root (shared between Python and TS) (superseded: Allure/Vitest approach used instead)
- [x] 1.2.3 Create `features/steps/` for step definitions (near features, not near source) (superseded: Allure/Vitest approach used instead)
- [x] 1.2.4 Set up cucumber.js config to run .feature files (superseded: Allure/Vitest approach used instead)
- [x] 1.2.5 Create first PoC: port one python-docx run formatting test (superseded: Allure/Vitest approach used instead)
- [x] 1.2.6 Document convention: `.feature` files in features/, unit tests co-located with source (superseded: Allure/Vitest approach used instead)

### 1.3 Supply Chain Security
- [ ] 1.3.1 Add GitHub Actions workflow with SLSA provenance
- [ ] 1.3.2 Configure npm publish with `--provenance` flag
- [ ] 1.3.3 Generate SBOM (Software Bill of Materials) on release
- [x] 1.3.4 Pin all dependency versions (no `^` or `~`)
- [ ] 1.3.5 Set up Dependabot for security updates
- [ ] 1.3.6 Add `npm audit` to CI pipeline
- [ ] 1.3.7 Configure signed git tags for releases
- [ ] 1.3.8 Add reproducible build configuration

### 1.4 CI/CD
- [x] 1.4.1 Add GitHub Actions workflow for TypeScript packages
- [ ] 1.4.2 Add test coverage reporting (target: >80%)
- [ ] 1.4.3 Add OpenSSF Scorecard badge

---

## Phase 2: Hard Differentiators (Do First)

> **Strategy**: Front-load the hardest, most differentiating features. These could each be standalone products and prove we can handle the complex cases.

### 2.1 Comparison Engine (Highest Priority)
> **Why first**: No TypeScript implementation exists. Currently uses `Aspose.Words.compare()`. Open-source alternatives are C# (WmlComparer) or Java (docx4j-diffx). Being first in TypeScript is a major differentiator.

- [x] 2.1.1 Research WmlComparer algorithm (Open XML PowerTools, MIT license)
- [x] 2.1.2 Research docx4j-diffx algorithm (Apache 2.0)
- [x] 2.1.3 Design comparison algorithm for TypeScript: (atomizer: char-level atoms + hierarchical LCS)
  - Structure-aware alignment (paragraph/table-cell level)
  - Text diff within aligned blocks (can use diff-match-patch as subroutine)
  - Output as track changes (w:ins, w:del) or operation list
- [x] 2.1.4 Implement `compareDocuments(original, revised)` function
- [x] 2.1.5 Implement output as Track Changes markup (w:ins, w:del in document.xml)
- [x] 2.1.6 Write Gherkin tests: `features/comparison/basic-comparison.feature` (Vitest tests instead of Gherkin)
- [x] 2.1.7 Write Gherkin tests: `features/comparison/formatting-preservation.feature` (Vitest tests instead of Gherkin)
- [x] 2.1.8 Benchmark against Aspose compare() output

### 2.2 Track Changes (Read/Write)
> **Why second**: Required for comparison output. Also useful standalone for reading/accepting/rejecting revisions.

- [x] 2.2.1 Implement reading track changes from document.xml:
  - Parse `w:ins` (insertions)
  - Parse `w:del` (deletions)
  - Parse `w:moveFrom`, `w:moveTo` (moves)
  - Extract revision author, date, id
- [x] 2.2.2 Implement writing track changes:
  - Insert `w:ins` wrapper around new content
  - Insert `w:del` wrapper around deleted content
  - Maintain revision IDs
- [x] 2.2.3 Implement `acceptAllRevisions()` and `rejectAllRevisions()`
- [x] 2.2.4 Implement `acceptRevision(id)` and `rejectRevision(id)`
- [x] 2.2.5 Write Gherkin tests: `features/track-changes/read-revisions.feature` (Vitest tests instead of Gherkin)
- [x] 2.2.6 Write Gherkin tests: `features/track-changes/write-revisions.feature` (Vitest tests instead of Gherkin)

### 2.3 Comments
> **Why third**: python-docx 1.2.0 added this (June 2025), but no TypeScript implementation. Common need for legal workflows (rationale bubbles).

- [x] 2.3.1 Implement reading comments:
  - Parse `word/comments.xml`
  - Link to document via `w:commentRangeStart`, `w:commentRangeEnd`, `w:commentReference`
  - Extract comment text, author, date, initials
- [x] 2.3.2 Implement writing comments:
  - Create entry in `comments.xml`
  - Insert range markers in document.xml
  - Insert `w:commentReference` in run
  - Update `[Content_Types].xml` and relationships
- [x] 2.3.3 Implement `addCommentOnRuns(runs, text, author, initials)` (done as `addComment()` with paragraph + text offset)
- [x] 2.3.4 Implement `getComments()` and `getComment(id)`
- [x] 2.3.5 Write Gherkin tests: `features/comments/add-comment.feature` (superseded: Vitest tests in `comments.test.ts`)
- [x] 2.3.6 Write Gherkin tests: `features/comments/read-comments.feature` (superseded: Vitest tests in `comments.test.ts`)
- [ ] 2.3.7 Port existing `add-edit-rationale-comments` openspec logic

### 2.4 Footnotes & Endnotes
> **Why fourth**: Lives in separate XML (footnotes.xml, endnotes.xml), tests multi-part handling.

- [x] 2.4.1 Implement reading footnotes/endnotes:
  - Parse `word/footnotes.xml` and `word/endnotes.xml`
  - Link to document via `w:footnoteReference`, `w:endnoteReference`
- [ ] 2.4.2 Implement writing footnotes:
  - Create entry in `footnotes.xml`
  - Insert reference in document.xml
  - Update relationships
- [x] 2.4.3 Write Gherkin tests: `features/footnotes/basic-footnotes.feature` (Vitest tests instead of Gherkin)

---

## Phase 3: OOXML Foundation & Core Primitives

> **Note**: These are easier and others have done them. Do after hard differentiators.

### 3.1 OOXML Foundation
- [x] 3.1.1 Create `namespaces.ts` with OOXML namespace constants
- [x] 3.1.2 Create `types.ts` with NodeType enum and protocol interfaces
- [x] 3.1.3 Implement XML parsing utilities using `@xmldom/xmldom` (DOM parse/serialize)
- [x] 3.1.4 Implement ZIP handling with `jszip`

### 3.2 Node Operations
- [x] 3.2.1 Implement `node_ops.ts`:
  - `insertBefore(parent, newChild, refChild)`
  - `insertAfter(parent, newChild, refChild)`
  - `removeNode(elem)`
  - `cloneNode(elem, deep)`
- [x] 3.2.2 Implement `splitRunAtOffset(run, offset)` - critical for surgical edits
- [x] 3.2.3 Implement `copyRunFormatting(source, target)`
- [x] 3.2.4 Implement `copyParagraphFormatting(source, target)`
- [x] 3.2.5 Write Gherkin tests: `features/node-ops/basic-operations.feature` (Vitest tests instead of Gherkin)

### 3.3 Run & Font Operations
- [x] 3.3.1 Implement `DocxRun` class with text get/set (functional TextRun type, not OOP class)
- [x] 3.3.2 Implement font properties: bold, italic, underline, name, size, color, highlight (functional approach, not property getters/setters)
- [x] 3.3.3 Implement `getRunText()` and `setRunText()`
- [x] 3.3.4 Write Gherkin tests: `features/runs/run-formatting.feature` (Vitest tests instead of Gherkin)

### 3.4 Paragraph Operations
- [x] 3.4.1 Implement `DocxParagraph` class (functional approach via document.ts, document_view.ts)
- [x] 3.4.2 Implement `getParagraphText()` (handles fields correctly)
- [x] 3.4.3 Implement paragraph formatting: alignment, style
- [x] 3.4.4 Implement `cloneParagraph(deep)`
- [x] 3.4.5 Write Gherkin tests: `features/paragraphs/paragraph-text.feature` (Vitest tests instead of Gherkin)

### 3.5 Bookmark Operations
- [x] 3.5.1 Implement `BookmarkIdAllocator` class
- [x] 3.5.2 Implement `insertBookmarkAroundParagraph(para, name)`
- [x] 3.5.3 Implement `removeBookmark(name)`
- [x] 3.5.4 Implement `findParagraphByBookmark(name)`
- [x] 3.5.5 Implement `getBookmarkForParagraph(para)`
- [x] 3.5.6 Write Gherkin tests: `features/bookmarks/bookmark-operations.feature` (Vitest tests instead of Gherkin)

### 3.6 Field Operations
- [x] 3.6.1 Implement field parsing (state machine for begin/separate/end)
- [x] 3.6.2 Implement `extractVisibleText(para)` - handles fields correctly
- [x] 3.6.3 Implement `parseFields(para)` returning FieldInfo[]
- [x] 3.6.4 Implement `hasFieldInParagraph(para)`
- [x] 3.6.5 Write Gherkin tests: `features/fields/field-parsing.feature` (Vitest tests instead of Gherkin)

### 3.7 Document Class
- [x] 3.7.1 Implement `DocxDocument` class with load/save
- [x] 3.7.2 Implement `getChildNodes(nodeType, recursive)`
- [x] 3.7.3 Implement `NodeCollection` with `.count` property
- [x] 3.7.4 Implement document range and bookmark collection access
- [x] 3.7.5 Write Gherkin tests: `features/document/document-operations.feature` (Vitest tests instead of Gherkin)

### 3.8 Integrity Checks
- [x] 3.8.1 Implement document validation (valid OOXML structure)
- [x] 3.8.2 Implement formatting preservation checks
- [x] 3.8.3 Implement safe refusal for unsupported operations
  - Return: "Couldn't safely apply operation; here's why; here's what I need"

---

## Phase 4: MCP Server Implementation

### 4.1 Server Setup
- [x] 4.1.1 Set up MCP server with `@modelcontextprotocol/sdk`
- [x] 4.1.2 Configure stdio transport for local usage
- [x] 4.1.3 Add server instructions/description

### 4.2 Session Management
- [x] 4.2.1 Implement `SessionManager` class
- [x] 4.2.2 Implement session ID generation (ses_xxxxxxxxxxxx format)
- [x] 4.2.3 Implement 1-hour TTL with automatic cleanup
- [x] 4.2.4 Store document state and edit count per session

### 4.3 Tool Implementation
- [x] 4.3.1 Implement `open_document` tool (readOnlyHint: true) - reads local file path
- [x] 4.3.2 Implement `read_file` tool (readOnlyHint: true)
- [x] 4.3.3 Implement `grep` tool (readOnlyHint: true)
- [x] 4.3.4 Implement `smart_edit` tool (destructiveHint: true)
- [x] 4.3.5 Implement `smart_insert` tool (destructiveHint: true)
- [x] 4.3.6 Implement `download` tool (destructiveHint: true) - saves to local path
- [x] 4.3.7 Implement `get_session_status` tool (readOnlyHint: true)
- [x] 4.3.8 Implement `add_comment` tool (destructiveHint: true) - done in `add_comment.ts`
- [x] 4.3.9 Implement `compare_documents` tool (readOnlyHint: true) - NEW

### 4.4 Error Handling
- [x] 4.4.1 Define error codes matching Python implementation
- [x] 4.4.2 Return helpful error messages with hints
- [x] 4.4.3 Implement graceful failure modes (no corruption)

---

## Phase 5: Testing & Equivalence

### 5.1 Gherkin Tests (Source of Truth)
> **Location**: `features/` directory, step definitions in `features/steps/`

- [x] 5.1.1 Port python-docx run formatting tests to Gherkin (superseded: Allure/Vitest approach used instead)
- [x] 5.1.2 Create Gherkin tests for UseJunior extensions (mark as EXTENDED) (superseded: Allure/Vitest approach used instead)
- [x] 5.1.3 Ensure all features from Phase 2-3 have corresponding .feature files (superseded: Allure/Vitest approach used instead)

### 5.2 Unit Tests (Co-located with Source)
> **Location**: `src/runs/run.test.ts` next to `src/runs/run.ts`

- [x] 5.2.1 Write unit tests for edge cases not covered by Gherkin
- [x] 5.2.2 Test internal implementation details
- [x] 5.2.3 Target >80% code coverage

### 5.3 Golden Tests (Integrity Checks)
- [x] 5.3.1 Create golden test corpus with expected outputs
- [x] 5.3.2 Test: formatting preserved after edit
- [x] 5.3.3 Test: numbering preserved after insert
- [x] 5.3.4 Test: styles preserved after replace
- [x] 5.3.5 Test: document opens in Word without errors

### 5.4 Equivalence Tests (Python vs TypeScript)
- [ ] 5.4.1 Run same .feature files against Python implementation
- [ ] 5.4.2 Run same .feature files against TypeScript implementation
- [ ] 5.4.3 Compare outputs for parity
- [ ] 5.4.4 Document any intentional differences

### 5.5 Integration Tests
- [x] 5.5.1 Test full edit workflow (open -> read -> edit -> save)
- [x] 5.5.2 Test session lifecycle
- [x] 5.5.3 Test with MCP Inspector

---

## Phase 6: Demo Kit (Harvey-Level Polish)

### 6.1 Reference UI
- [ ] 6.1.1 Create simple web UI:
  - Upload document
  - Choose operation (edit/insert/compare)
  - Preview diff
  - Download result
- [ ] 6.1.2 Use React or vanilla JS (keep it simple)
- [ ] 6.1.3 Host on GitHub Pages or Vercel

### 6.2 Diff View
- [ ] 6.2.1 Implement deterministic diff generation
- [ ] 6.2.2 Show what changed AND what didn't
- [ ] 6.2.3 Visual formatting: additions (green), deletions (red)
- [ ] 6.2.4 Include paragraph IDs in diff output

### 6.3 Benchmarks
- [x] 6.3.1 Create synthetic test corpus (10-100 page docs)
- [x] 6.3.2 Measure: cold start, edit latency, save time
- [x] 6.3.3 Measure: formatting fidelity (before/after comparison)
- [x] 6.3.4 Measure: comparison engine speed vs Aspose
- [x] 6.3.5 Publish benchmark results in README

### 6.4 Failure Mode Demos
- [ ] 6.4.1 Demo: safe refusal on unsupported operation
- [ ] 6.4.2 Demo: error with actionable guidance
- [ ] 6.4.3 Demo: document remains valid even after failed op

---

## Phase 7: Documentation & Distribution

### 7.1 README (Credibility-Focused)
- [x] 7.1.1 Write README.md with structure:
  - **Title**: Atomic DOCX Ops for LLM Workflows
  - **Why**: LLMs are good at text, but DOCX editing fails without safe primitives
  - **Core idea**: operations are atomic + composable; output is deterministic
  - **Differentiators**: Comparison engine, comments, track changes (no other TS lib does this)
  - **Quickstart**: 5-line example
  - **Demo**: gif/video embed
  - **Guarantees**: what you preserve (styles, numbering, structure)
  - **Non-goals**: what you explicitly don't promise
  - **Benchmarks**: speed + corpus description
  - **Contributing**: tests, fixtures, style
- [ ] 7.1.2 Add "Powered by Safe Docx" badge for builders
- [ ] 7.1.3 Add enterprise CTA: "For hosted/enterprise, contact us"

### 7.2 Supporting Docs
- [ ] 7.2.1 Write EXAMPLES.md with 5+ real use cases
- [ ] 7.2.2 Write PRIVACY.md (local processing, no data collection)
- [ ] 7.2.3 Write CHANGELOG.md
- [ ] 7.2.4 Add inline JSDoc/TSDoc comments

### 7.3 NPM Publishing
- [ ] 7.3.1 Configure package.json for publishing
- [ ] 7.3.2 Publish to npm with provenance
- [ ] 7.3.3 Test `npx @usejunior/safe-docx` installation

### 7.4 Anthropic Submission
- [ ] 7.4.1 Prepare manifest.json for MCP directory
- [ ] 7.4.2 Submit to Anthropic MCP directory
- [ ] 7.4.3 Apply for OpenSSF Best Practices badge

---

## Phase 8: Launch

### 8.1 Demo Video
- [ ] 8.1.1 Record 2-3 minute demo:
  - Show document open from local path
  - Show operation selection
  - Show diff view / comparison
  - Show preserved formatting
  - Show comment insertion
  - Show safe error handling
- [ ] 8.1.2 Upload to YouTube/Loom
- [ ] 8.1.3 Create animated GIF for README

### 8.2 LinkedIn Announcement
- [ ] 8.2.1 Finalize announcement post (draft below)
- [ ] 8.2.2 Identify 5-10 builders to DM before public post
- [ ] 8.2.3 Post announcement
- [ ] 8.2.4 Cross-post to Twitter/X, Hacker News (optional)

### 8.3 Builder Outreach
- [ ] 8.3.1 Identify solo builders in legal AI space
- [ ] 8.3.2 DM with demo kit link before public announcement
- [ ] 8.3.3 Offer to help with integration
- [ ] 8.3.4 Collect "Powered by" commitments

---

## Phase 9: Validation

### 9.1 Feature Parity
- [ ] 9.1.1 Compare output with Python implementation
- [ ] 9.1.2 Verify formatting preservation matches
- [ ] 9.1.3 Verify bookmark IDs are compatible

### 9.2 Performance
- [ ] 9.2.1 Cold start time <500ms
- [ ] 9.2.2 Edit latency <100ms
- [ ] 9.2.3 Large document support (100+ pages)
- [ ] 9.2.4 Comparison engine: <2s for 50-page docs

### 9.3 Cross-Platform
- [ ] 9.3.1 Test on macOS
- [ ] 9.3.2 Test on Windows
- [ ] 9.3.3 Test in Claude Desktop

---

## Phase 10: OpenSpec Scenario Traceability (2026-02-11)

- [x] 10.1 Add Allure scenario tests for `add-typescript-mcp-server` coverage:
  - tool annotations (read-only/destructive)
  - session lifecycle (creation/expiration/concurrency)
  - path compatibility checks (`~` and win32 backslash runtime gate)
  - error handling (`FILE_NOT_FOUND`, `INVALID_FILE_TYPE`, `SESSION_NOT_FOUND`)
  - atomic edit integrity and OOXML validity checks
- [x] 10.2 Export MCP tool registry + transport mode from `packages/safe-docx-ts/src/server.ts` for direct policy regression assertions.
- [x] 10.3 Add scenario-to-test traceability matrix at `packages/safe-docx-ts/test/SAFE_DOCX_OPENSPEC_TRACEABILITY.md`.

---

## LinkedIn Announcement Draft

```
Today we're releasing Safe Docx: atomic operations for editing .docx files safely.

If you've tried "AI edits in Word" you've probably seen the failure modes: formatting drift, broken numbering, corrupted documents, slow round-trips, and changes that are hard to review. That's a non-starter for legal work.

This project focuses on non-destructive, composable edits—the primitives you need to build professional-grade document workflows (insert/replace/delete, style-safe handling, deterministic outputs, and testable integrity constraints).

What makes this different:
- Document comparison engine (first in TypeScript)
- Native comments support (add rationale bubbles)
- Track changes read/write
- BDD tests for behavioral guarantees

The goal is simple: make it easier for builders to ship serious document experiences—so the best demos and products aren't limited to a couple big players.

Repo + demo: [link]

If you're building doc-heavy AI workflows (legal, compliance, finance), I'd love to see what you build.
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Cold start time | <500ms |
| Test coverage | >80% |
| OpenSSF Scorecard | Passing |
| GitHub stars (week 1) | 50+ |
| Builders using (month 1) | 5+ |
| Anthropic directory | Listed |
| Comparison parity with Aspose | >95% accuracy |

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Comparison engine too hard | Start with simpler paragraph-level diff, iterate. WmlComparer is MIT - can study algorithm |
| Big labs copy approach | We're trading implementation for trust + distribution + standard-setting |
| Becomes unpaid support | Keep scope tight: core primitives + demo kit + tests only |
| Competitors fork | Trademark protection separate from MIT; be canonical upstream |
| Supply chain attack | SLSA provenance, signed releases, minimal deps, npm audit |

---

## Feature Count Summary

Based on analysis of existing Python abstraction layer:

| Category | Count | Priority |
|----------|-------|----------|
| **Comparison Engine** | 8 tasks | Phase 2 (FIRST) |
| **Track Changes** | 6 tasks | Phase 2 |
| **Comments** | 7 tasks | Phase 2 |
| **Footnotes** | 3 tasks | Phase 2 |
| **Core Primitives** | ~50 features | Phase 3 |
| **MCP Tools** | 9 tools | Phase 4 |
| **OOXML Extensions** | 37 functions | Phase 3 |

Total distinct features: ~87 (excluding comparison engine which is new)

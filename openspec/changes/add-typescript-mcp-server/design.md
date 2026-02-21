# Design: TypeScript MCP Server for Safe Docx

## Context

The Python MCP server works correctly but faces distribution friction:
- Anthropic bundles Node.js with Claude Desktop, not Python
- NPM packages can be installed via `npx` with zero setup
- The `.mcpb` bundle format is newer and less tested than NPM distribution
- Anthropic's official MCP servers are all TypeScript

### Stakeholders
- **End users**: Claude Desktop users editing Word documents
- **Anthropic**: MCP directory curators preferring Node.js
- **Junior team**: Maintaining two codebases (internal Python, external TypeScript)
- **Community**: Developers building on Safe Docx

## Goals / Non-Goals

### Goals
- Frictionless installation via `npx @usejunior/safe-docx`
- Feature parity with Python implementation (all 7 tools)
- Same atomic operations safety guarantees
- <500ms cold start for responsive UX
- MIT licensed for Anthropic directory inclusion

### Non-Goals
- Full python-docx API compatibility in TypeScript
- Supporting legacy Node.js versions (<18)
- Real-time collaborative editing
- Maintaining Python mcpb bundle alongside TypeScript

## Key Decisions

### Decision 1: Use `docx` npm package + direct XML manipulation

**Choice**: Hybrid approach using `docx` for document creation and `@xmldom/xmldom` DOM parsing/serialization for safe OOXML editing

**Rationale**:
- `docx` npm package is well-maintained but focused on document generation, not editing
- For editing existing documents, we need direct OOXML manipulation (like Python's lxml approach)
- `jszip` for .docx archive handling, `@xmldom/xmldom` for XML operations (DOM-based round-tripping)

**Alternatives considered**:
- `mammoth.js` - Converts to HTML, loses formatting (rejected)
- `officegen` - Generation only, no editing (rejected)
- Pure `docx` - Doesn't support editing existing documents well (rejected)
- `docxtemplater` - Template-focused, not surgical editing (rejected)

### Decision 2: Monorepo with separate packages

**Choice**:
```
packages/
├── safe-docx-ts/           # MCP server (publishable to NPM)
└── docx-primitives-ts/     # Core document operations (internal)
```

**Rationale**:
- Separation allows primitives to be reused if needed
- NPM package (`safe-docx-ts`) stays focused on MCP interface
- Mirrors Python structure (`app/mcp_server/` + `app/shared/document_primitives/`)

### Decision 3: No Python bridge

**Choice**: Pure TypeScript implementation, no subprocess calls to Python

**Rationale**:
- Subprocess bridge adds latency and deployment complexity
- Users would still need Python installed, defeating the purpose
- TypeScript ecosystem has adequate XML/ZIP handling
- Algorithms (atomic operations, bookmark targeting) are portable concepts

### Decision 4: Session management in-memory

**Choice**: In-memory session store with 1-hour TTL (same as Python)

**Rationale**:
- Local MCP servers don't need persistence across restarts
- Simpler than SQLite or file-based storage
- Matches Python implementation behavior

### Decision 5: Use @modelcontextprotocol/sdk

**Choice**: Official MCP TypeScript SDK for protocol handling

**Rationale**:
- Maintained by Anthropic
- Handles stdio transport, tool registration, annotations
- Well-documented and actively developed

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Desktop                        │
│                         │                                │
│                    stdio transport                       │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │            safe-docx-ts (MCP Server)            │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │  Tools: open_document, read_file, grep, │   │    │
│  │  │  smart_edit, smart_insert, download,    │   │    │
│  │  │  get_session_status                     │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  │                      │                          │    │
│  │              SessionManager                     │    │
│  │                      │                          │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │        docx-primitives-ts               │   │    │
│  │  │  ┌───────────┐  ┌───────────────────┐  │   │    │
│  │  │  │  DocxDoc  │  │  BookmarkManager  │  │   │    │
│  │  │  └───────────┘  └───────────────────┘  │   │    │
│  │  │  ┌───────────┐  ┌───────────────────┐  │   │    │
│  │  │  │NodeOps    │  │  FieldParser      │  │   │    │
│  │  │  └───────────┘  └───────────────────┘  │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                jszip + @xmldom/xmldom                    │
│                         │                                │
│                    .docx file                            │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Runtime Dependencies
| Package | Purpose | Size |
|---------|---------|------|
| `@modelcontextprotocol/sdk` | MCP protocol handling | ~50KB |
| `jszip` | .docx archive handling | ~90KB |
| `@xmldom/xmldom` | XML DOM parse/serialize (safe edits) | ~? |
| `uuid` | Session ID generation | ~5KB |

### Dev Dependencies
- `typescript` - Language
- `tsx` - Development runner
- `vitest` - Testing
- `eslint` + `prettier` - Linting

### Estimated bundle size: ~300KB (before minification)

## Risks / Trade-offs

### Risk 1: XML manipulation complexity
TypeScript XML libraries are less mature than Python's lxml.

**Mitigation**:
- Comprehensive test suite ported from Python
- Use DOM-based editing via `@xmldom/xmldom` to reduce round-trip corruption risk
- Refuse unsafe edits (return actionable error) rather than guessing

### Risk 2: Maintaining two codebases
Python and TypeScript implementations may drift.

**Mitigation**:
- Document core algorithms in `design.md`
- Shared test fixtures (sample .docx files)
- Python remains "reference" for edge case behavior
- TypeScript gets feature parity, not necessarily identical code

### Risk 3: NPM supply chain
Publishing to NPM exposes to supply chain attacks.

**Mitigation**:
- Use npm provenance (SLSA attestation)
- Pin dependency versions
- Minimal dependency tree
- Regular `npm audit`

## Migration Plan

### Phase 1: Core Primitives (Week 1-2)
1. Set up monorepo structure with pnpm workspaces
2. Implement OOXML namespace constants
3. Implement NodeOps (insert, remove, clone)
4. Implement BookmarkManager
5. Implement DocxDocument (load, save, get_child_nodes)

### Phase 2: MCP Server (Week 2-3)
1. Set up MCP server with @modelcontextprotocol/sdk
2. Implement session management
3. Wire tools to primitives layer
4. Add tool annotations

### Phase 3: Testing & Polish (Week 3-4)
1. Port test fixtures from Python
2. Comprehensive integration tests
3. Performance benchmarking
4. Documentation and examples

### Phase 4: Distribution (Week 4)
1. Publish to NPM as `@usejunior/safe-docx`
2. Submit to Anthropic MCP directory
3. Update GitHub repo with TypeScript focus

## Open Questions

1. **Package naming**: `@usejunior/safe-docx` vs `safe-docx` (unscoped)?
   - Scoped provides namespace, unscoped is shorter for `npx`
   - Recommendation: `@usejunior/safe-docx` for brand association

2. **Node version support**: 18+ or 20+?
   - Node 18 is LTS until April 2025
   - Node 20 is current LTS
   - Recommendation: Node 18+ for broader compatibility

3. **Field parsing**: Port Python's field_parser or simplify?
   - Python handles complex Word fields (TOC, cross-refs)
   - May not be needed for v1 of TypeScript version
   - Recommendation: Simplify for v1, add complexity as needed

## File Structure

```
packages/
├── safe-docx-ts/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── server.ts             # MCP server setup
│   │   ├── tools/
│   │   │   ├── open_document.ts
│   │   │   ├── read_file.ts
│   │   │   ├── grep.ts
│   │   │   ├── smart_edit.ts
│   │   │   ├── smart_insert.ts
│   │   │   ├── download.ts
│   │   │   └── get_session_status.ts
│   │   └── session/
│   │       └── manager.ts
│   └── test/
│       └── *.test.ts
│
└── docx-primitives-ts/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts
    │   ├── document.ts           # DocxDocument class
    │   ├── paragraph.ts          # DocxParagraph class
    │   ├── run.ts                # DocxRun class
    │   ├── bookmark.ts           # Bookmark operations
    │   ├── node_ops.ts           # Node manipulation
    │   ├── namespaces.ts         # OOXML constants
    │   └── types.ts              # TypeScript interfaces
    └── test/
        ├── fixtures/             # Sample .docx files
        └── *.test.ts
```

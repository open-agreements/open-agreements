## 1. Phase 1 - Download Diagnostics and Probing

- [x] 1.1 Add `HEAD` support to `api/download.ts` with parity status semantics to `GET`
- [x] 1.2 Add machine-readable download error codes for missing param, malformed link, invalid signature, and expired link
- [x] 1.3 Add integration tests for `GET` and `HEAD` error/success cases

## 2. Phase 2 - Opaque Download IDs

- [x] 2.1 Add a TTL-backed download artifact store abstraction
- [x] 2.2 Issue opaque `download_id` and id-based `download_url` in MCP fill responses
- [x] 2.3 Resolve downloads by `download_id` in `api/download.ts`
- [x] 2.4 Remove token-based link handling from hosted MCP and download endpoint contracts
- [x] 2.5 Add integration tests covering id-based flows

## 3. Validation and Docs

- [x] 3.1 Update API/MCP docs for the new download contract (`download_id`, error codes, method support)
- [x] 3.2 Run `openspec validate update-download-link-resilience --strict`
- [x] 3.3 Run relevant API integration tests for `api/mcp.ts` and `api/download.ts`

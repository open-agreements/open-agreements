## 1. Make indexer walk all directories
- [ ] 1.1 Add IGNORED_DIRS and DOCUMENT_EXTENSIONS to constants.ts
- [ ] 1.2 Refactor collectWorkspaceDocuments to walk all non-ignored dirs
- [ ] 1.3 Make DocumentRecord.lifecycle optional
- [ ] 1.4 Update lint rules to be conditional on lifecycle presence
- [ ] 1.5 Update existing tests

## 2. Revise core analysis layer
- [ ] 2.1 Drop document_id from types and store
- [ ] 2.2 Rename sidecar to .contract.yaml
- [ ] 2.3 Add document type validation (canonical 15 + custom + raw_type fallback)
- [ ] 2.4 Add config loading for custom_document_types
- [ ] 2.5 Implement atomic sidecar writes
- [ ] 2.6 Add orphan detection
- [ ] 2.7 Rename tools to index_contract, get_contract_index, list_unindexed_contracts
- [ ] 2.8 Make get_contract_index dual-mode (single doc + portfolio overview)
- [ ] 2.9 Update all tests

## 3. BM25 search
- [ ] 3.1 Add minisearch dependency
- [ ] 3.2 Create search-index.ts (in-memory build from sidecars)
- [ ] 3.3 Wire into search_contracts tool
- [ ] 3.4 Add format:'markdown' option
- [ ] 3.5 Write tests

## 4. SKILL.md
- [ ] 4.1 Create contract-indexer SKILL.md

## 5. Build and verify
- [ ] 5.1 Build both packages
- [ ] 5.2 Run all tests
- [ ] 5.3 E2E validation

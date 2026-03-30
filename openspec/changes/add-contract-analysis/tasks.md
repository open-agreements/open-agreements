## 1. Core Analysis Layer (contracts-workspace)
- [ ] 1.1 Add ANALYSIS_DIR and ANALYSIS_DOCUMENTS_DIR constants to constants.ts
- [ ] 1.2 Create analysis-types.ts with DocumentType, DocumentClassification, ClauseExtraction, DocumentAnalysis
- [ ] 1.3 Create analysis-store.ts with read/write/list/staleness/document_id generation
- [ ] 1.4 Create analysis-indexer.ts with enrichDocumentRecord and buildAnalysisSummary
- [ ] 1.5 Extend types.ts with optional classification, analyzed, stale fields on DocumentRecord and analysis summary on StatusIndex
- [ ] 1.6 Update index.ts to re-export new modules
- [ ] 1.7 Write tests/analysis.test.ts using MemoryProvider

## 2. MCP Tools (contracts-workspace-mcp)
- [ ] 2.1 Add save_contract_analysis tool
- [ ] 2.2 Add read_contract_analysis tool
- [ ] 2.3 Add list_pending_contracts tool
- [ ] 2.4 Add search_contracts tool
- [ ] 2.5 Add suggest_contract_rename tool
- [ ] 2.6 Wire enrichStatusIndex into status_generate tool
- [ ] 2.7 Write tests/analysis-tools.test.ts
- [ ] 2.8 Update tool listing tests

## 3. Build and Verify
- [ ] 3.1 Build both packages with tsc
- [ ] 3.2 Run all tests for both packages

---
name: contract-indexer
description: >-
  Batch-index contracts in a workspace — classify document types, extract
  key provisions, and build a searchable contract portfolio. Designed for
  parallel execution across many documents.
allowed-tools:
  - index_contract
  - get_contract_index
  - list_unindexed_contracts
  - search_contracts
  - mcp__safe-docx__read_file
---

# Contract Indexer

Index contracts in a `@open-agreements/contracts-workspace-mcp` workspace. Each
indexed contract gets a `.contract.yaml` sidecar file with classification,
extracted clauses, and a content hash for staleness detection.

## When to Use

Use this skill when:
- `list_unindexed_contracts` returns documents needing indexing
- A user asks "What contracts do we have?" or "What's in this contract?"
- You need to batch-process a folder of contracts for the first time

## How to Index One Document

1. **Read the document**: Use `mcp__safe-docx__read_file` for DOCX, or read PDFs natively
2. **Classify**: Determine document type, parties, dates, governing law, and write a 1-2 sentence summary
3. **Extract key clauses**: Look for these provisions:
   - Governing law / jurisdiction
   - Termination (notice periods, grounds, cure periods)
   - Indemnification (scope, carve-outs)
   - Limitation of liability (caps, consequential damages exclusions)
   - Confidentiality (scope, duration, exceptions)
   - Assignment / change of control restrictions
   - Dispute resolution (arbitration vs litigation)
4. **Store results**: Call `index_contract` with the classification and extractions

## Document Types

Use one of these canonical types:

| Type | Description |
|------|-------------|
| `nda` | Non-disclosure / confidentiality agreement |
| `msa` | Master services agreement |
| `sow` | Statement of work |
| `employment-agreement` | Employment contract |
| `consulting-agreement` | Consulting / independent contractor |
| `saas-agreement` | SaaS / cloud service agreement |
| `license-agreement` | Software or IP license |
| `ip-assignment` | Intellectual property assignment |
| `stock-purchase-agreement` | Stock purchase agreement |
| `safe` | Simple Agreement for Future Equity |
| `lpa` | Limited partnership agreement |
| `ppm` | Private placement memorandum |
| `subscription-agreement` | Subscription / investor docs |
| `amendment` | Amendment to existing agreement |
| `addendum` | Addendum to existing agreement |

If the document doesn't fit any canonical type, use the closest match or provide
your best description — `index_contract` will store it as `raw_type` and flag it
for type resolution.

Custom types can be added to `.contracts-workspace/config.yaml`.

## Parallel Batch Indexing

For large workspaces (50+ documents):

1. Call `list_unindexed_contracts` to get the queue
2. Spawn subagents — each handles one document independently
3. Each subagent reads the document, classifies, extracts, calls `index_contract`
4. Per-document sidecar files prevent write conflicts — safe for parallel execution

## Cost Guidance

Use the cheapest model that can reliably extract parties, dates, and a summary
from clean text. Escalate to a more capable model for:
- Scanned PDFs requiring OCR
- Long exhibits (50+ pages)
- Ambiguous clause extraction
- Complex multi-party agreements

## After Indexing

- `search_contracts` with a text query does BM25 ranked search across all indexed contracts
- `get_contract_index` without a path returns a portfolio overview (counts, types, expiring-soon)
- `search_contracts` with `format: 'markdown'` returns a table you can paste into an email

# ADR 0001: Open Counsel custody and content lineage

- Status: Accepted
- Date: 2026-09-02
- Decision owners: OpenAgreements maintainers
- Related issues: #708, #709

## Context

Open Counsel is a runtime-neutral package that helps an agent turn a caller's
company records into evidence-linked legal work. Public legal resources and
private company state have different owners, licenses, and security boundaries.
Combining them in a hosted OpenAgreements service would make UseJunior the
default custodian of company records and would obscure which legal source
version produced an answer.

## Decision

The implementation will live under `packages/open-counsel`. Its domain logic
must depend on ports, not a particular agent runtime, filesystem, identity
provider, or hosted database.

### Trust boundaries

1. **Public content boundary.** Legal Explainer is the authoring source for
   substantive guidance. Its projection pipeline publishes licensed,
   versioned artifacts into OpenAgreements. Open Counsel consumes committed
   projection manifests through a `CatalogProvider`; it does not edit or fork
   substantive guidance.
2. **Caller custody boundary.** Company documents, extracted facts, access
   labels, matter events, approvals, and derived snapshots remain in storage
   selected and controlled by the caller. They are read and written through a
   `StateProvider`. Installing Open Counsel does not transmit that state to
   UseJunior.
3. **Authorization boundary.** A `PrincipalResolver` establishes the caller and
   an `AuthorizationPolicy` authorizes access before search results, filenames,
   snippets, or metadata are returned. A single-owner policy is the safe
   zero-configuration default; callers may replace it without changing domain
   records.
4. **Runtime boundary.** Codex, Claude, Cursor, MCP, and other adapters translate
   runtime calls into the same package interfaces. No adapter owns canonical
   state or legal content.

Provider interfaces use caller-supplied URIs and stable identifiers. Providers
must declare capabilities such as atomic writes, audit events, retention, and
legal hold. The package must not infer a capability merely because state is
stored in Git or a local filesystem.

### Release boundary

The first public release is the benchmarking substrate plus the Working
Co-founder workflow (the #708 A+B combination). The substrate by itself is an
internal foundation, not a separately marketed legal product.

### Consequential actions

The core package prepares review and approval packages. Its port surface has no
operation to send, sign, hire, run payroll, file with a government, issue
equity, or declare a final worker classification or legal conclusion. A future
action adapter would require a separate decision, explicit authorization, and
human approval gates.

### Explicitly absent from runtime scope

- hosted Open Counsel state or a UseJunior-managed company-record database;
- live `~/Matters` access or assumptions about its configuration;
- Vanta tenant access, controls, evidence, or copied Vanta expression;
- a live MCP endpoint as the authority for legal content;
- payroll, tax, filing, signature, or equity-issuance integrations.

## Consequences

- Every reproducible work product can name a canonical content ID, projection
  revision, and artifact hash.
- Private state can be resumed across agent sessions without a chat transcript,
  while remaining in caller custody.
- Enterprise identity, storage, audit, and retention systems can be added as
  adapters instead of migrations of the domain model.
- Local storage alone cannot honestly promise read auditing, retention, legal
  hold, or ethical walls; capability declarations must expose those limits.
- Missing, stale, or hash-mismatched content stops the affected workflow rather
  than falling back to model memory.

## Rejected alternatives

### UseJunior-hosted state by default

Rejected because it changes the custody and threat model, adds a new sensitive
data processor, and is unnecessary for a caller-owned first release.

### Runtime-specific implementations

Rejected because behavior, access controls, and resumability would drift among
agent products and become difficult to test with one conformance fixture.

### Live retrieval as the source of truth

Rejected because mutable network responses cannot provide the pinned artifact
identity and offline reproducibility required by the approval package.

### Git history as an audit or records-management system

Rejected because commit history does not establish identity-linked reads,
ethical walls, retention enforcement, or legal hold.

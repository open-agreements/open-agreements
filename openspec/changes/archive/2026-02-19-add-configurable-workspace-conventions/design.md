## Context

The contracts-workspace CLI was built with hardcoded conventions suited to a
greenfield local directory. Real-world adoption targets include existing Google
Drive shared drives with years of accumulated documents following their own
naming conventions. Forcing these environments to adopt `_executed` and
snake_case creates an adoption barrier.

This design extracts conventions into a config file that the init scanner
populates by observing existing content.

Stakeholders: teams adopting workspace tooling on existing document collections,
AI agents operating in those workspaces, the open-agreements maintainers.

## Goals / Non-Goals

- Goals:
  - Make workspace conventions configurable without breaking existing workspaces
  - Init observes and adapts to existing file naming patterns
  - Each domain folder is self-documenting via FOLDER.md
  - Lint validates against configured conventions, not hardcoded ones
  - Not all domains need lifecycle subfolders

- Non-Goals:
  - Bulk rename/migration tooling (future change)
  - Cloud API integration (separate proposal)
  - Interactive convention editor
  - Per-file metadata sidecars

## Decisions

### Convention config location and format

- Decision: `.contracts-workspace/conventions.yaml`
- Why: YAML is human-readable and consistent with `forms-catalog.yaml` and
  `contracts-index.yaml`. Hidden directory keeps workspace root clean.
- Alternatives: JSON (less readable), root-level file (clutters workspace),
  embedded in CONTRACTS.md (fragile parsing).

### Convention config schema

```yaml
schema_version: 1

# Status marker detection
executed_marker:
  pattern: "_executed"        # Regex or literal suffix
  location: "before_extension" # "before_extension" | "in_parentheses" | "custom"

# Naming style
naming:
  style: "kebab-case"         # "kebab-case" | "snake_case" | "title-case-dash" | "observed"
  separator: "-"              # Primary word separator
  date_format: "YYYY-MM-DD"   # ISO 8601 default

# Lifecycle configuration
lifecycle:
  folders:                     # Customizable folder names
    forms: "forms"
    drafts: "drafts"
    incoming: "incoming"
    executed: "executed"
    archive: "archive"
  applicable_domains:          # Which top-level folders get lifecycle subfolders
    - "Vendor Agreements"
    - "Employment and Human Resources"
    - "Equity Documents"
    - "Organizational Documents"
  asset_domains:               # Flat collections, no lifecycle subfolders
    - "Logos"
    - "Presentations"
    - "Media Assets"

# Cross-reference policy
cross_references:
  policy: "references-not-copies"
  mechanism: "platform-agnostic" # Guidance only, not enforced

# Workspace documentation
documentation:
  root_file: "WORKSPACE.md"
  folder_file: "FOLDER.md"
```

### Scanner inference strategy

- Decision: The scanner examines existing filenames to infer conventions, with a
  bias toward defaults when evidence is ambiguous.
- Algorithm:
  1. Collect all filenames in the workspace
  2. Count occurrences of known status patterns (`_executed`, `(executed)`,
     `(fully executed)`, `(signed)`, `_signed`)
  3. Detect dominant casing (Title Case with spaces, snake_case, kebab-case)
  4. Detect dominant separator (hyphen, underscore, space-dash-space)
  5. If >60% of files match a pattern, adopt it. Otherwise, use defaults.
- Why: Avoids forcing conventions on existing content. The 60% threshold prevents
  a few outlier files from overriding a clear majority convention.
- Alternative: Always use defaults, require manual config. Rejected because it
  defeats the purpose of adaptive init.

### Lifecycle applicability

- Decision: Convention config explicitly lists which domains are lifecycle
  domains vs asset domains. Init only creates lifecycle subfolders for lifecycle
  domains.
- Why: Not all document categories have a draft→executed→archived lifecycle.
  Logos, presentations, and media assets are just collections. Creating empty
  `Logos/drafts/` and `Logos/executed/` folders is noise.
- Alternative: Apply lifecycle to everything. Rejected based on user feedback
  that most domains don't need it.

### FOLDER.md as dual-purpose documentation

- Decision: Each domain folder gets a `FOLDER.md` that serves both as human
  documentation and AI agent instructions.
- Template:
  ```markdown
  # {Folder Name}

  ## Purpose
  {Auto-generated or user-provided description}

  ## Naming Convention
  {Configured naming style and examples}

  ## Status Markers
  {Configured executed marker pattern}

  ## Lifecycle
  {Whether this is a lifecycle domain or asset domain}
  {If lifecycle: list of applicable stages}

  ## Owner
  {Team or person responsible — blank by default}
  ```
- Why: A single file that both humans can read and AI agents can parse. Follows
  the OpenSpec AGENTS.md pattern where documentation doubles as instructions.

### Filename authority vs folder organization

- Decision: Filename status marker is authoritative. Lint warns (not errors) when
  folder location disagrees.
- Why: Files get moved, copied, shared outside the workspace. The filename is the
  only metadata that reliably travels with the document. Folder location is
  organizational context that aids navigation but isn't the source of truth.
- Alternative: Folder is authoritative. Rejected because files lose context when
  moved or shared.

## Risks / Trade-offs

- Risk: Convention scanner misidentifies patterns in small workspaces
  → Mitigation: Scanner requires minimum file count (e.g., 5) before inferring.
  Below threshold, uses defaults. Config is always editable.

- Risk: Convention config adds complexity for simple workspaces
  → Mitigation: Config is auto-generated and optional. Workspaces without it
  fall back to current behavior. Users only touch it if they want to customize.

- Risk: FOLDER.md gets stale as workspace evolves
  → Mitigation: `status lint` can check for FOLDER.md presence and warn if
  missing. Content staleness is inherent to documentation — same trade-off as
  CONTRACTS.md today.

## Migration Plan

1. Add convention config loading with fallback to defaults (zero behavior change)
2. Update lint and indexer to read conventions from config
3. Add scanner and integrate with init
4. Add WORKSPACE.md and FOLDER.md generation
5. Update CONTRACTS.md template to reference convention config
6. All changes are backward-compatible — no migration needed for existing workspaces

## Open Questions

- Should the scanner also detect date format conventions (YYYY-MM-DD vs
  written-out dates)? Currently planned but may add complexity.
- Should FOLDER.md be generated only for lifecycle domains, or for all folders?
  Current plan: all folders, since asset domains also benefit from documentation.

## ADDED Requirements

### Requirement: Gated Skills Directory Publish Workflow
The repository SHALL provide a manually triggered workflow that can publish
source-controlled `skills/` directories to supported external skill registries
without relying on local browser sessions.

#### Scenario: Publish changed skills after a squash merge
- **WHEN** maintainers run the workflow with scope `changed` after a squash
  merge to `main`
- **THEN** the workflow identifies the changed skill directories relative to the
  provided base ref
- **AND** publishes only those skill directories to the requested targets

#### Scenario: Publish a selected subset of skills
- **WHEN** maintainers run the workflow with scope `selected` and an explicit
  comma-separated skill list
- **THEN** only the named skill directories are published
- **AND** the workflow fails with a clear error if a requested skill directory
  does not exist or lacks a `SKILL.md`

### Requirement: Skill Version-Sourced Directory Publishing
Directory publish automation SHALL source each skill's publish version from the
declared `metadata.version` in that skill's `SKILL.md`.

#### Scenario: ClawHub publish uses declared skill version
- **WHEN** the workflow publishes a skill to ClawHub
- **THEN** it reads the version from that skill's `SKILL.md`
- **AND** passes the declared version to the ClawHub publish command
- **AND** does not invent or auto-bump a separate registry-only version

### Requirement: Explicit Directory Publish Scope
The repository SHALL automate only registries with a supported authenticated
publish path, and SHALL document when a discovery surface is intentionally not
treated as a CI publish target.

#### Scenario: Workflow excludes skills.sh from publish steps
- **WHEN** maintainers review the workflow and release docs
- **THEN** ClawHub and Smithery are the only automated external skill
  registries
- **AND** docs explicitly state that `skills.sh` is a discovery/indexing
  surface rather than a direct CI publish target

### Requirement: Token-Based Registry Authentication
The workflow SHALL use non-interactive token-based authentication for requested
registry targets and fail clearly when required auth is missing.

#### Scenario: Missing target secret blocks requested publish
- **WHEN** the workflow is asked to publish to Smithery or ClawHub
- **AND** the corresponding repository secret is missing
- **THEN** the workflow fails before attempting a publish to that target
- **AND** the logs identify which secret is required

## MODIFIED Requirements

### Requirement: Contract IR Pointer-Based Template Authoring
The system SHALL support a Contract IR authoring path where a canonical
Markdown content document points, via YAML frontmatter, to an external schema
registry and an external style registry.

#### Scenario: [OA-TMP-029] Content document resolves external registries
- **WHEN** a Contract IR template is loaded from `template.md`
- **THEN** the loader resolves the referenced schema and style YAML files
- **AND** the normalized template model retains document metadata, variables,
  and style semantics from those external registries

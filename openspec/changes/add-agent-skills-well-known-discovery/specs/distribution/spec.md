## ADDED Requirements

### Requirement: Well-Known Agent Skills Discovery
The site build SHALL publish an RFC 8615-compatible agent skills discovery index
at the canonical origin. The index SHALL use the v0.2.0 discovery schema, list
only public skills, and provide one deterministic archive URL and SHA-256 digest
per listed skill.

#### Scenario: [OA-DST-087] Domain install discovers public skill archives
- **WHEN** the project builds the site discovery indexes
- **THEN** the generated agent skills index uses the v0.2.0 schema
- **AND** every listed skill has an archive URL and matching SHA-256 digest
- **AND** internal skills are not listed
- **AND** each archive contains a root `SKILL.md`

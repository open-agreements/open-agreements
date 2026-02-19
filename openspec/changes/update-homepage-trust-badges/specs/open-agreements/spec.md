## ADDED Requirements

### Requirement: Homepage Trust Badges
The homepage SHALL display visual trust badges (npm version, CI status,
template validation, code coverage, test framework) as shield.io images
alongside the existing text-based pill links.

#### Scenario: Badge row renders on homepage
- **WHEN** a user visits the homepage
- **THEN** they see a badge row with npm, CI, Validate Templates, Codecov, and Vitest badges

### Requirement: Live MCP Status Indicator
The homepage SHALL include a live status indicator that pings the MCP endpoint
and visually shows whether the service is up (green pulsing dot) or down (red dot).

#### Scenario: MCP endpoint is reachable
- **WHEN** the homepage loads and the MCP ping succeeds
- **THEN** the status dot turns green with a pulse animation

#### Scenario: MCP endpoint is unreachable
- **WHEN** the homepage loads and the MCP ping fails or times out
- **THEN** the status dot turns red

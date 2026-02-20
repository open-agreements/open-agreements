# Change: Update homepage with trust badges and live status

## Why

The homepage trust row currently shows text-only links. Adding visual badges
(npm version, CI status, coverage, test framework) and a live MCP status
indicator improves trust signals for teams evaluating OpenAgreements. This
aligns with the pending `add-public-quality-dashboard` proposal requirements.

## What Changes

- Rename "status" pill to "status page" with a pulsing green/red dot indicator
- Add badge row with npm version, CI, Validate Templates, Codecov, and Vitest badges
- Add live MCP ping via `checkMcpStatus()` with JSON-RPC `id` field and 5s timeout
- Add CSS for `.status-dot` pulse animation and `.badge-row` flex layout

## Impact
- Affected specs: open-agreements
- Affected code:
  - `site/index.njk` (pill text, status dot, badge row)
  - `site/src/input.css` (status dot animation, badge row styles)
  - `site/main.js` (MCP status ping function)
- Compatibility: additive, visual-only changes

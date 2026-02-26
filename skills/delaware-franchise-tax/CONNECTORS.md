# Connectors

## How tool references work

This skill uses `~~category` placeholders for optional integrations. The skill works without any connectors — they enhance the experience when available.

## Connectors for this skill

| Category | Placeholder | Example servers |
|----------|-------------|-----------------|
| Calendar | `~~calendar` | Google Calendar MCP, Microsoft 365 MCP |
| Cloud storage | `~~cloud storage` | Google Drive, Dropbox, Box (for finding tax docs, prior filings) |
| Browser | `~~browser` | [Playwright skill](https://github.com/lackeyjb/playwright-skill), browser-use (for portal navigation assistance) |
| Banking | `~~banking` | Mercury MCP, Stripe MCP (for looking up account balances to estimate gross assets) |

Note: The Delaware eCorp portal prohibits automated tools. Browser connectors can assist with navigation but the user should always confirm and submit manually.

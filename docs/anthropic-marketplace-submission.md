# Anthropic Claude Community Marketplace Submission

Status: Draft for review. Do not submit without explicit approval.

Requirements last checked: 2026-07-22

## Submission route

- Console form: <https://platform.claude.com/plugins/submit>
- Anthropic documentation: <https://code.claude.com/docs/en/plugins#submit-your-plugin-to-the-community-marketplace>
- Target catalog: `anthropics/claude-plugins-community`

Third-party submissions enter the Claude Community marketplace after review.
The separate official marketplace has no application process.

## Plugin source

- Plugin name: `open-agreements`
- Display name: `Open Agreements`
- Repository: <https://github.com/open-agreements/open-agreements>
- Plugin subdirectory: `plugins/open-agreements`
- Recommended catalog source type: `git-subdir`
- Homepage: <https://openagreements.org>
- Publisher contact: `steven@usejunior.com`
- Plugin-package license: Apache-2.0
- Bundled legal explainer content: CC BY 4.0, with per-skill license and notice files

## Proposed marketplace description

Use source-cited legal practice guides, review checklists, 50-state surveys, and
fill-ready agreement templates. Includes offline non-compete and U.S.
privacy-law explainers with snapshot dates and authority citations, plus a local
CLI workflow for standard forms such as NDAs and SAFEs. Provides general legal
information and practitioner starting points, not legal advice.

## Suggested classification

- Category: Productivity
- Tags: legal, practice guides, legal research, state law, contracts, checklists,
  templates, open source

## Included components

The initial package includes three skills:

1. `open-agreements`, for navigating practice guides, checklists, surveys, and
   templates, with local template filling through a pinned CLI.
2. `non-compete-contract-explainer`, with bundled jurisdiction snapshots and
   source citations.
3. `data-privacy-law-explainer`, with bundled U.S. state-law snapshots and
   source citations.

The package does not include `skills/internal`, an MCP server, hooks, agents,
background processes, executable scripts, or authentication.

## Reviewer notes

- Practice-guide answers state their snapshot date and cite the included legal
  authorities.
- The explainer skills prohibit individualized legal or compliance verdicts and
  direct users to licensed counsel for advice on their facts.
- The skills treat bundled and fetched content as reference material, not as
  instructions.
- Optional web refreshes fetch a fixed canonical public URL and do not transmit
  the user's facts, contract text, or data inventory.
- Template filling defaults to the pinned local `open-agreements@0.8.0` CLI.
  npm access may occur during installation. Listing and filling then run locally.
- The plugin does not automatically connect to the hosted Open Agreements MCP
  endpoint or send template values to a hosted service.

## Pre-submission verification

Run from the repository root:

```bash
npm run generate:claude-plugin
npm run check:claude-plugin
claude plugin validate ./plugins/open-agreements --strict
```

Then test a local session:

```bash
claude --plugin-dir ./plugins/open-agreements
```

Suggested smoke prompts:

1. `What does the bundled Texas non-compete guide say, and what is its snapshot date?`
2. `Explain whether the Virginia consumer privacy law provides a private right of action.`
3. `Find an Open Agreements practice guide about AI hiring and cite its sources.`
4. `List the information you would need to fill a mutual NDA, but do not create a file yet.`

## Submission boundary

Preparing and validating this package does not authorize submission. The Console
form is a public-facing action and requires separate explicit approval.

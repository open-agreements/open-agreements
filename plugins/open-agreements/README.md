# Open Agreements for Claude Code

Use source-cited legal practice guides, review checklists, state-law surveys,
and fill-ready agreement templates from Open Agreements.

The initial Claude Community Marketplace package is deliberately focused. It
contains three skills:

- `open-agreements`: navigate the full Open Agreements library and fill standard
  templates through the pinned local CLI.
- `non-compete-contract-explainer`: read bundled, source-cited restrictive-
  covenant guidance by jurisdiction.
- `data-privacy-law-explainer`: read bundled, source-cited U.S. consumer-privacy
  guidance by state.

Repository-maintenance skills under the source repository's `skills/internal/`
directory are not included.

## Network and data behavior

This plugin does not bundle an MCP server, hooks, agents, background processes,
or authentication. The two state-law explainers work from content included in
the plugin. The general navigator may fetch fixed public URLs from
openagreements.org when a user asks for other practice guides, checklists, or
surveys.

Template filling defaults to `open-agreements@0.8.0` through a local global
installation or pinned `npx`. npm may access the registry during installation;
template listing and filling then run locally. A separately configured MCP
server remains optional, but installing this plugin does not add or start one.

## Local validation

From the repository root:

```bash
npm run check:claude-plugin
claude plugin validate ./plugins/open-agreements --strict
claude --plugin-dir ./plugins/open-agreements
```

The generated `skills/` directory is synchronized from the canonical public
skills in the repository. Regenerate it after changing a source skill:

```bash
npm run generate:claude-plugin
```

## Licensing and legal information

The plugin packaging and Open Agreements navigator are Apache-2.0 licensed.
The bundled legal explainer content is CC BY 4.0 and carries its own license,
notice, attribution, snapshot date, and canonical source links.

The plugin provides general legal information and practitioner starting points.
It does not provide legal advice or create an attorney-client relationship.

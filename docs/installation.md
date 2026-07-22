---
title: Install OpenAgreements
description: Choose the recommended local CLI or an MCP integration.
order: 1
section: Start Here
---

# Install OpenAgreements

Use the local CLI for the shortest path to private, repeatable document filling.
It requires Node.js 20 or newer and keeps document processing on your machine.

## Install the local CLI

```bash
npm install -g open-agreements
open-agreements --version
```

Continue with [Fill and review your first agreement](quickstart.md).

## Run once without a global install

Use an explicit package version when reproducibility matters:

```bash
npx open-agreements@0.8.0 list
```

Review the package and version before executing it. `npx` downloads code from
the npm registry if the requested version is not already cached.

## Build from source

Use this path when contributing or testing unreleased changes:

```bash
git clone https://github.com/open-agreements/open-agreements.git
cd open-agreements
npm ci
npm run build
node bin/open-agreements.js --version
```

Contributor checks and repository conventions live in
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Connect through MCP

Choose local stdio MCP when documents must stay on the machine running the
agent. Choose hosted MCP for the smallest setup when server-side processing is
acceptable. The two local servers and client examples are documented in
[Connect an AI agent](using-with-ai-agents.md).

Hosted template filling sends field values and document-processing inputs to
the hosted service. Check the [trust-boundary status](trust-checklist.md) before using
hosted mode with sensitive material.

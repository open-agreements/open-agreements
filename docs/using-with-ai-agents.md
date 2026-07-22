# Connect an AI agent

An MCP-compatible agent can discover standard forms, collect field values, and
render a DOCX. The agent orchestrates the workflow; OpenAgreements remains the
source of template metadata and the document-filling boundary.

Read [Install OpenAgreements](installation.md) before choosing local or hosted
execution. The [trust-boundary status](trust-checklist.md) describes the data-flow
tradeoff.

## Use the local template server

`@open-agreements/contract-templates-mcp` exposes three tools over stdio:

```text
list_templates → get_template → fill_template
```

The agent first discovers candidates, then inspects the selected template's
fields, then supplies values and requests an output path. Document processing
stays on the machine running the MCP server. Configure your client to launch the
installed package according to that client's stdio-server format.

## Use the hosted template server

Connect an MCP client to:

```text
https://openagreements.org/api/mcp
```

For example:

```bash
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp
codex mcp add open-agreements --url https://openagreements.org/api/mcp
```

Hosted mode has the smallest setup, but field values and processing inputs cross
the hosted-service trust boundary.

## Install an agent skill

Agent skills add task-specific instructions around the same underlying tools:

```bash
npx skills add open-agreements/open-agreements --skill nda
```

Browse maintained skill names in the [catalog](reference/catalog.md#install-an-agent-skill).
Review a skill before installing it; skill instructions can invoke local tools.

## Install the Gemini CLI extension

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

The repository also includes a Cursor plugin manifest at
`.cursor-plugin/plugin.json`.

## Ask for an outcome

A useful prompt names the form and the business context without asking the agent
to make the final legal decision:

```text
Fill the Common Paper Mutual NDA for Acme Manufacturing and Northeast Logistics.
Interview me for every priority field, save the DOCX locally, and list the terms
I must review before signature.
```

The expected sequence is:

1. discover available templates;
2. inspect the chosen template and its source/license metadata;
3. collect required and priority fields;
4. render the DOCX;
5. report warnings and the output path; and
6. leave acceptance and signature to a person.

For direct automation without an agent, use the [CLI reference](reference/cli.md).
For workspace folder planning and lifecycle status, see
[Contracts Workspace](contracts-workspace.md).

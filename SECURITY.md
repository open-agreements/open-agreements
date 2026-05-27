# Security Policy

## Supported versions

Security fixes are supported for the current minor version of the `open-agreements` npm package only.

| Package version | Supported |
| --- | --- |
| `0.7.x` | Yes |
| `< 0.7` | No |

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub's private vulnerability advisory flow:

https://github.com/open-agreements/open-agreements/security/advisories/new

If GitHub advisories are not available to you, email steven@usejunior.com with a concise description, affected versions, reproduction steps, and any relevant proof of concept. We acknowledge reports as soon as we can and coordinate fixes through the private advisory when appropriate.

Please do not open a public GitHub issue for a suspected vulnerability until the issue has been assessed and any needed fix is available.

## In scope

- The `open-agreements` npm package.
- MCP server code under `packages/contract-templates-mcp/` and `packages/contracts-workspace-mcp/`.
- The template-fill pipeline.
- Signing utilities.

## Out of scope

- Template content quality or legal accuracy.
- Third-party AI providers.
- Vulnerabilities in user-supplied data.
- Upstream template sources, including Common Paper, Bonterms, Y Combinator, NVCA, and similar publishers.

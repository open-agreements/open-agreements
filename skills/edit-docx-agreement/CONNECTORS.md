# Connectors

## OpenAgreements (for template filling)

Use the standard OpenAgreements connectors (remote MCP or local CLI) for fill operations.
See https://github.com/open-agreements/open-agreements/blob/main/skills/open-agreements/CONNECTORS.md for details.

## Safe Docx MCP (for surgical DOCX editing)

Safe Docx is a **separate MCP server** that must be configured independently.
It is not part of the OpenAgreements skill set.

The user must have Safe Docx MCP already set up in their agent environment.
If Safe Docx tools are not available, instruct the user to:

1. Visit https://github.com/UseJunior/safe-docx for setup instructions
2. Configure the Safe Docx MCP server in their agent's MCP settings
3. Restart their agent session

Do not instruct the agent to download or install packages at runtime.

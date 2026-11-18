// Exercise the same handlers exported by the extension's template MCP server.
import { callTool } from '../../packages/contract-templates-mcp/dist/contract-templates-mcp/src/core/tools.js';
let data = '';
for await (const chunk of process.stdin) data += chunk;
const { name, args } = JSON.parse(data);
const result = await callTool(name, args);
process.stdout.write(JSON.stringify(result));

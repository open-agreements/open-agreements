/**
 * Spike: Selective 401 on MCP tools/call
 *
 * Minimal MCP server (Streamable HTTP) that:
 * - Returns 200 for initialize, tools/list
 * - Returns 401 + WWW-Authenticate for tools/call on "protected_tool"
 * - Returns 200 for tools/call on "public_tool"
 *
 * Purpose: test whether Claude Code, Claude Desktop, and Gemini CLI
 * handle a mid-session 401 by initiating OAuth, or if they throw a
 * transport error.
 *
 * Run: npx tsx spike/selective-401/server.ts
 * Then: claude mcp add --transport http test-401 http://localhost:4401/mcp
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const PORT = 4401;
const RESOURCE_URI = 'http://localhost:4401/mcp';

// ── Well-known metadata ────────────────────────────────────────────────────

const protectedResourceMetadata = {
  resource: RESOURCE_URI,
  authorization_servers: ['http://localhost:4401'],
  scopes_supported: ['signing'],
  bearer_methods_supported: ['header'],
};

const authServerMetadata = {
  issuer: 'http://localhost:4401',
  authorization_endpoint: 'http://localhost:4401/authorize',
  token_endpoint: 'http://localhost:4401/token',
  registration_endpoint: 'http://localhost:4401/register',
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};

// ── MCP tool definitions ───────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'public_tool',
    description: 'A public tool that does not require authentication.',
    inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  },
  {
    name: 'protected_tool',
    description: 'A protected tool that requires signing scope. Simulates send_for_signature.',
    inputSchema: { type: 'object', properties: { data: { type: 'string' } } },
  },
];

const PROTECTED_TOOLS = new Set(['protected_tool']);

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonRpcResponse(id: unknown, result: unknown) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
}

// ── Request handler ────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // Well-known endpoints
  if (url.pathname === '/.well-known/oauth-protected-resource') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(protectedResourceMetadata));
    return;
  }

  if (url.pathname === '/.well-known/oauth-authorization-server') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(authServerMetadata));
    return;
  }

  // Stub authorize endpoint (just to see if clients reach it)
  if (url.pathname === '/authorize') {
    console.log('>>> CLIENT REACHED /authorize — OAuth flow initiated! <<<');
    console.log('    Query:', Object.fromEntries(url.searchParams));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>OAuth Authorize</h1><p>If you see this, the client initiated OAuth after a mid-session 401!</p>');
    return;
  }

  // Stub register endpoint (DCR)
  if (url.pathname === '/register' && req.method === 'POST') {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    console.log('>>> DCR registration request <<<');
    console.log('    Client:', parsed.client_name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      client_id: 'spike-test-client-' + Date.now(),
      client_name: parsed.client_name,
      redirect_uris: parsed.redirect_uris,
    }));
    return;
  }

  // MCP endpoint
  if (url.pathname === '/mcp' && req.method === 'POST') {
    const body = await readBody(req);
    let rpc: { jsonrpc: string; id: unknown; method: string; params?: unknown };
    try {
      rpc = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(jsonRpcError(null, -32700, 'Parse error'));
      return;
    }

    console.log(`MCP request: ${rpc.method}`, rpc.params ? JSON.stringify(rpc.params).slice(0, 100) : '');

    // initialize
    if (rpc.method === 'initialize') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonRpcResponse(rpc.id, {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'selective-401-spike', version: '0.0.1' },
      }));
      return;
    }

    // notifications/initialized
    if (rpc.method === 'notifications/initialized') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonRpcResponse(rpc.id, {}));
      return;
    }

    // tools/list
    if (rpc.method === 'tools/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonRpcResponse(rpc.id, { tools: TOOLS }));
      return;
    }

    // tools/call — the key test
    if (rpc.method === 'tools/call') {
      const params = rpc.params as { name: string; arguments?: unknown } | undefined;
      const toolName = params?.name;

      if (toolName && PROTECTED_TOOLS.has(toolName)) {
        // Check for Bearer token
        const authHeader = req.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
          console.log(`>>> 401 for protected tool "${toolName}" — no Bearer token <<<`);
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': `Bearer resource_metadata="${RESOURCE_URI}/.well-known/oauth-protected-resource"`,
          });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            id: rpc.id,
            error: { code: -32001, message: 'Authentication required for signing tools.' },
          }));
          return;
        }

        // Valid token — succeed
        console.log(`>>> Protected tool "${toolName}" called with Bearer token <<<`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(jsonRpcResponse(rpc.id, {
          content: [{ type: 'text', text: `Protected tool "${toolName}" executed successfully with auth.` }],
        }));
        return;
      }

      // Public tool — no auth needed
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonRpcResponse(rpc.id, {
        content: [{ type: 'text', text: `Public tool "${toolName}" executed (no auth required).` }],
      }));
      return;
    }

    // ping
    if (rpc.method === 'ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonRpcResponse(rpc.id, {}));
      return;
    }

    // Unknown method
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(jsonRpcError(rpc.id, -32601, `Method not found: ${rpc.method}`));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// ── Start ──────────────────────────────────────────────────────────────────

const server = createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`\n=== Selective 401 Spike Server ===`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`\nTo test with Claude Code:`);
  console.log(`  claude mcp add --transport http test-401 http://localhost:${PORT}/mcp`);
  console.log(`  Then ask Claude to use "protected_tool"\n`);
  console.log(`Watch this terminal for:`);
  console.log(`  - "401 for protected tool" = client got the challenge`);
  console.log(`  - "CLIENT REACHED /authorize" = client initiated OAuth (SUCCESS)`);
  console.log(`  - If neither appears, the client silently failed\n`);
});

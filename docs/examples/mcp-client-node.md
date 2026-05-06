# MCP Client Example (Node.js + TypeScript)

Minimal streamable HTTP flow for OpenAgreements hosted MCP.

## Example

```ts
type RpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
};

type ToolEnvelopeSuccess<T> = {
  ok: true;
  tool: string;
  schema_version: string;
  data: T;
};

type ToolEnvelopeError = {
  ok: false;
  tool: string;
  schema_version: string;
  error: {
    code: string;
    message: string;
    retriable: boolean;
    details?: Record<string, unknown>;
  };
};

type ToolEnvelope<T> = ToolEnvelopeSuccess<T> | ToolEnvelopeError;

const MCP_URL = 'https://openagreements.org/api/mcp';

async function rpc(id: number, method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as RpcResponse;
}

function parseEnvelope<T = any>(result: any): ToolEnvelope<T> {
  const text = result.content?.[0]?.text;
  if (typeof text !== 'string') throw new Error('Missing tool envelope content');
  return JSON.parse(text) as ToolEnvelope<T>;
}

(async () => {
  await rpc(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'node-example', version: '1.0.0' },
  });

  // list_templates returns a compact-only paginated catalog. Page through
  // using the returned cursor; stop when next_cursor is null.
  let templateId: string | undefined;
  let cursor: string | undefined;
  for (;;) {
    const args: Record<string, unknown> = { limit: 50 };
    if (cursor !== undefined) args.cursor = cursor;
    const listResp = await rpc(2, 'tools/call', { name: 'list_templates', arguments: args });
    const listEnv = parseEnvelope<{
      templates: Array<{ template_id: string }>;
      total_count: number;
      next_cursor: string | null;
    }>(listResp.result);
    if (!listEnv.ok) throw new Error(`${listEnv.error.code}: ${listEnv.error.message}`);
    if (templateId === undefined && listEnv.data.templates[0]) {
      templateId = listEnv.data.templates[0].template_id;
    }
    if (listEnv.data.next_cursor === null) break;
    cursor = listEnv.data.next_cursor;
  }
  if (!templateId) throw new Error('No templates returned');

  const getResp = await rpc(3, 'tools/call', {
    name: 'get_template',
    arguments: { template_id: templateId },
  });
  const getEnv = parseEnvelope(getResp.result);
  if (!getEnv.ok) throw new Error(`${getEnv.error.code}: ${getEnv.error.message}`);

  const fillResp = await rpc(4, 'tools/call', {
    name: 'fill_template',
    arguments: {
      template: templateId,
      values: { company_name: 'Acme Corp' },
      return_mode: 'url',
    },
  });
  const fillEnv = parseEnvelope<{ download_url: string }>(fillResp.result);
  if (!fillEnv.ok) throw new Error(`${fillEnv.error.code}: ${fillEnv.error.message}`);

  console.log('Download URL:', fillEnv.data.download_url);
})();
```

## Notes
- Use `fill_template` with `return_mode: 'url'`, then download via `curl -L "$DOWNLOAD_URL" -o filled.docx`.
- Tool results always return one JSON envelope text block.
- Error handling should branch on `envelope.ok` and `envelope.error.code`.

import { callTool, listToolDescriptors, type ToolCallResult } from './tools.js';

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const SERVER_INFO = {
  name: 'open-agreements-contract-templates-mcp',
  version: '0.2.0',
};

const FALLBACK_PROTOCOL_VERSION = '2024-11-05';

export function runStdioServer(): void {
  const parser = new StdioMessageParser();

  process.stdin.on('data', async (chunk: Buffer) => {
    for (const message of parser.push(chunk)) {
      try {
        await handleMessage(message);
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[open-agreements-contract-templates-mcp] unhandled error: ${details}\n`);
      }
    }
  });

  process.stdin.on('error', (error) => {
    process.stderr.write(`[open-agreements-contract-templates-mcp] stdin error: ${error.message}\n`);
  });

  process.stdin.resume();
}

async function handleMessage(message: unknown): Promise<void> {
  if (!isRequestObject(message)) {
    return;
  }

  const request = message as JsonRpcRequest;
  const id = request.id ?? null;

  if (request.method === 'notifications/initialized') {
    return;
  }

  if (request.method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: pickProtocolVersion(request.params),
        capabilities: {
          tools: {},
        },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (request.id === undefined) {
    return;
  }

  if (request.method === 'ping') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {},
    });
    return;
  }

  if (request.method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: listToolDescriptors(),
      },
    });
    return;
  }

  if (request.method === 'tools/call') {
    const call = parseToolCall(request.params);
    if (!call) {
      sendError(id, -32602, 'Invalid params for tools/call. Expected { name: string, arguments?: object }.');
      return;
    }

    const result = await callTool(call.name, call.argumentsValue);
    sendResponse({
      jsonrpc: '2.0',
      id,
      result,
    });
    return;
  }

  sendError(id, -32601, `Method not found: ${request.method}`);
}

function parseToolCall(params: unknown): { name: string; argumentsValue: unknown } | null {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const parsed = params as Record<string, unknown>;
  if (typeof parsed.name !== 'string' || parsed.name.length === 0) {
    return null;
  }

  return {
    name: parsed.name,
    argumentsValue: parsed.arguments ?? {},
  };
}

function pickProtocolVersion(params: unknown): string {
  if (!params || typeof params !== 'object') {
    return FALLBACK_PROTOCOL_VERSION;
  }

  const protocolVersion = (params as Record<string, unknown>).protocolVersion;
  return typeof protocolVersion === 'string' && protocolVersion.length > 0
    ? protocolVersion
    : FALLBACK_PROTOCOL_VERSION;
}

function sendResponse(response: JsonRpcResponse): void {
  const body = JSON.stringify(response);
  const bytes = Buffer.byteLength(body, 'utf8');
  const framed = `Content-Length: ${bytes}\r\nContent-Type: application/json\r\n\r\n${body}`;
  process.stdout.write(framed);
}

function sendError(id: JsonRpcId, code: number, message: string, data?: unknown): void {
  sendResponse({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  });
}

function isRequestObject(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.jsonrpc === '2.0' && typeof candidate.method === 'string';
}

class StdioMessageParser {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];

    while (true) {
      this.trimLeadingNoise();
      if (this.buffer.length === 0) {
        break;
      }

      if (startsWithContentLengthHeader(this.buffer)) {
        const parsed = this.parseHeaderFramedMessage();
        if (parsed === null) {
          break;
        }
        if (parsed.length === 0) {
          continue;
        }

        const message = safeParseJson(parsed);
        if (message !== null) {
          messages.push(message);
        }
        continue;
      }

      const line = this.parseLineMessage();
      if (line === null) {
        break;
      }
      if (line.length === 0) {
        continue;
      }

      const message = safeParseJson(line);
      if (message !== null) {
        messages.push(message);
      }
    }

    return messages;
  }

  private trimLeadingNoise(): void {
    while (this.buffer.length > 0) {
      const first = this.buffer[0];
      if (first === 13 || first === 10) {
        this.buffer = this.buffer.subarray(1);
        continue;
      }
      break;
    }
  }

  private parseHeaderFramedMessage(): string | null {
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return null;
    }

    const headerText = this.buffer.subarray(0, headerEnd).toString('utf8');
    const contentLength = extractContentLength(headerText);
    if (contentLength === null) {
      this.buffer = this.buffer.subarray(headerEnd + 4);
      return '';
    }

    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;
    if (this.buffer.length < bodyEnd) {
      return null;
    }

    const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8').trim();
    this.buffer = this.buffer.subarray(bodyEnd);
    return body;
  }

  private parseLineMessage(): string | null {
    const newlineIndex = this.buffer.indexOf('\n');
    if (newlineIndex === -1) {
      return null;
    }

    const line = this.buffer.subarray(0, newlineIndex).toString('utf8').trim();
    this.buffer = this.buffer.subarray(newlineIndex + 1);
    return line;
  }
}

function startsWithContentLengthHeader(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 32)).toString('utf8').toLowerCase();
  return head.startsWith('content-length:');
}

function extractContentLength(headerText: string): number | null {
  const match = /content-length:\s*(\d+)/i.exec(headerText);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export type { ToolCallResult };

import { listSurveyResources, readSurveyResource, SurveyFetchError } from './surveys.js';
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

/** MCP spec error code for resources/read of an unknown resource. */
const RESOURCE_NOT_FOUND_ERROR_CODE = -32002;

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
  const response = await dispatchMessage(message);
  if (response !== null) {
    sendResponse(response);
  }
}

/**
 * Dispatch one JSON-RPC message and return the response to send, or null when
 * no response is due (notifications, malformed messages). Exported for tests.
 */
export async function dispatchMessage(message: unknown): Promise<JsonRpcResponse | null> {
  if (!isRequestObject(message)) {
    return null;
  }

  const request = message as JsonRpcRequest;
  const id = request.id ?? null;

  if (request.method === 'notifications/initialized') {
    return null;
  }

  if (request.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: pickProtocolVersion(request.params),
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: SERVER_INFO,
      },
    };
  }

  if (request.id === undefined) {
    return null;
  }

  if (request.method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (request.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: listToolDescriptors(),
      },
    };
  }

  if (request.method === 'tools/call') {
    const call = parseToolCall(request.params);
    if (!call) {
      return errorResponse(id, -32602, 'Invalid params for tools/call. Expected { name: string, arguments?: object }.');
    }

    const result = await callTool(call.name, call.argumentsValue);
    return { jsonrpc: '2.0', id, result };
  }

  if (request.method === 'resources/list') {
    try {
      const resources = await listSurveyResources();
      return { jsonrpc: '2.0', id, result: { resources } };
    } catch (error) {
      return errorResponse(id, -32603, `Failed to list resources: ${describeError(error)}`);
    }
  }

  if (request.method === 'resources/templates/list') {
    return { jsonrpc: '2.0', id, result: { resourceTemplates: [] } };
  }

  if (request.method === 'resources/read') {
    const uri = parseResourceReadUri(request.params);
    if (uri === null) {
      return errorResponse(id, -32602, 'Invalid params for resources/read. Expected { uri: string }.');
    }

    try {
      const contents = await readSurveyResource(uri);
      if (contents === null) {
        return errorResponse(id, RESOURCE_NOT_FOUND_ERROR_CODE, `Resource not found: ${uri}`, { uri });
      }
      return { jsonrpc: '2.0', id, result: { contents: [contents] } };
    } catch (error) {
      return errorResponse(id, -32603, `Failed to read resource: ${describeError(error)}`);
    }
  }

  return errorResponse(id, -32601, `Method not found: ${request.method}`);
}

function describeError(error: unknown): string {
  if (error instanceof SurveyFetchError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function parseResourceReadUri(params: unknown): string | null {
  if (!params || typeof params !== 'object') {
    return null;
  }
  const uri = (params as Record<string, unknown>).uri;
  return typeof uri === 'string' && uri.length > 0 ? uri : null;
}

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
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
  process.stdout.write(JSON.stringify(response) + '\n');
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

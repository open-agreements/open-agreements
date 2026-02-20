/**
 * MCP response envelope helpers.
 * File starts with _ so Vercel does not create a route for it.
 */

export const SCHEMA_VERSION = '2026-02-19';

export const ErrorCode = {
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  DOWNLOAD_LINK_INVALID: 'DOWNLOAD_LINK_INVALID',
  DOWNLOAD_LINK_EXPIRED: 'DOWNLOAD_LINK_EXPIRED',
  DOWNLOAD_LINK_NOT_FOUND: 'DOWNLOAD_LINK_NOT_FOUND',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ToolErrorObject {
  code: ErrorCodeValue;
  message: string;
  retriable: boolean;
  details?: Record<string, unknown>;
}

export interface ToolEnvelopeSuccess<T> {
  ok: true;
  tool: string;
  schema_version: typeof SCHEMA_VERSION;
  data: T;
}

export interface ToolEnvelopeError {
  ok: false;
  tool: string;
  schema_version: typeof SCHEMA_VERSION;
  error: ToolErrorObject;
}

export function wrapSuccess<T>(tool: string, data: T): ToolEnvelopeSuccess<T> {
  return {
    ok: true,
    tool,
    schema_version: SCHEMA_VERSION,
    data,
  };
}

export function wrapError(tool: string, error: ToolErrorObject): ToolEnvelopeError {
  return {
    ok: false,
    tool,
    schema_version: SCHEMA_VERSION,
    error,
  };
}

export function makeToolError(
  code: ErrorCodeValue,
  message: string,
  opts?: { retriable?: boolean; details?: Record<string, unknown> },
): ToolErrorObject {
  return {
    code,
    message,
    retriable: opts?.retriable ?? false,
    ...(opts?.details ? { details: opts.details } : {}),
  };
}

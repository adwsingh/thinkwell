/**
 * JSON-RPC 2.0 protocol types
 */

/**
 * JSON-RPC message ID - can be string, number, or null
 */
export type JsonRpcId = string | number | null;

/**
 * JSON-RPC error object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC request message
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC notification message (request without id)
 */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC success response
 */
export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

/**
 * JSON-RPC error response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: JsonRpcError;
}

/**
 * JSON-RPC response (success or error)
 */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/**
 * Any JSON-RPC message
 */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

/**
 * Type guard for JSON-RPC request
 */
export function isJsonRpcRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return "method" in message && "id" in message;
}

/**
 * Type guard for JSON-RPC notification
 */
export function isJsonRpcNotification(message: JsonRpcMessage): message is JsonRpcNotification {
  return "method" in message && !("id" in message);
}

/**
 * Type guard for JSON-RPC response
 */
export function isJsonRpcResponse(message: JsonRpcMessage): message is JsonRpcResponse {
  return "id" in message && !("method" in message);
}

/**
 * Type guard for JSON-RPC success response
 */
export function isJsonRpcSuccessResponse(
  message: JsonRpcMessage
): message is JsonRpcSuccessResponse {
  return isJsonRpcResponse(message) && "result" in message;
}

/**
 * Type guard for JSON-RPC error response
 */
export function isJsonRpcErrorResponse(message: JsonRpcMessage): message is JsonRpcErrorResponse {
  return isJsonRpcResponse(message) && "error" in message;
}

/**
 * Standard JSON-RPC error codes
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * Create a JSON-RPC request
 */
export function createRequest(id: JsonRpcId, method: string, params?: unknown): JsonRpcRequest {
  const request: JsonRpcRequest = { jsonrpc: "2.0", id, method };
  if (params !== undefined) {
    request.params = params;
  }
  return request;
}

/**
 * Create a JSON-RPC notification
 */
export function createNotification(method: string, params?: unknown): JsonRpcNotification {
  const notification: JsonRpcNotification = { jsonrpc: "2.0", method };
  if (params !== undefined) {
    notification.params = params;
  }
  return notification;
}

/**
 * Create a JSON-RPC success response
 */
export function createSuccessResponse(id: JsonRpcId, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Create a JSON-RPC error response
 */
export function createErrorResponse(id: JsonRpcId, error: JsonRpcError): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error };
}

// JSON types
export type { JsonValue, JsonObject, JsonSchema } from "./json.js";

// JSON-RPC types
export type {
  JsonRpcId,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
  JsonRpcResponse,
  JsonRpcMessage,
} from "./json-rpc.js";

export {
  isJsonRpcRequest,
  isJsonRpcNotification,
  isJsonRpcResponse,
  isJsonRpcSuccessResponse,
  isJsonRpcErrorResponse,
  JsonRpcErrorCodes,
  createRequest,
  createNotification,
  createSuccessResponse,
  createErrorResponse,
} from "./json-rpc.js";

// MCP-over-ACP types
export type {
  McpServerConfig,
  McpContext,
  McpConnectRequest,
  McpConnectResponse,
  McpMessageRequest,
  McpMessageResponse,
  McpContent,
  McpError,
  McpDisconnectNotification,
  McpToolsListResult,
  McpToolDefinition,
  McpToolsCallParams,
  McpToolsCallResult,
} from "./mcp-over-acp.js";

// Dispatch types
export type {
  Responder,
  RequestDispatch,
  NotificationDispatch,
  ResponseDispatch,
  Dispatch,
} from "./dispatch.js";

export {
  isRequestDispatch,
  isNotificationDispatch,
  isResponseDispatch,
  createResponder,
} from "./dispatch.js";

// Proxy protocol types
export type {
  ProxySuccessorRequestParams,
  ProxySuccessorNotificationParams,
} from "./proxy-protocol.js";

export {
  PROXY_SUCCESSOR_REQUEST,
  PROXY_SUCCESSOR_NOTIFICATION,
  isProxySuccessorRequest,
  isProxySuccessorNotification,
  unwrapProxySuccessorRequest,
  unwrapProxySuccessorNotification,
  wrapAsProxySuccessorRequest,
  wrapAsProxySuccessorNotification,
  isProxyProtocolMethod,
} from "./proxy-protocol.js";

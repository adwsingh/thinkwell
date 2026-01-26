/**
 * MCP-over-ACP protocol types
 *
 * These types define the protocol for bridging MCP (Model Context Protocol)
 * over ACP (Agent Client Protocol) connections.
 */

import type { JsonSchema } from "./json.js";

/**
 * MCP server configuration for session requests
 */
export interface McpServerConfig {
  type: "http";
  name: string;
  url: string;
}

/**
 * Context provided to tool handlers
 */
export interface McpContext {
  /** The connection ID for this MCP session */
  connectionId: string;
  /** The session ID for the ACP session */
  sessionId: string;
}

/**
 * MCP connect request from conductor
 */
export interface McpConnectRequest {
  method: "_mcp/connect";
  params: {
    connectionId: string;
    url: string;
  };
}

/**
 * MCP connect response
 */
export interface McpConnectResponse {
  connectionId: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: Record<string, unknown>;
  };
  /** Optional tool definitions - the bridge may use these to pre-populate tool info */
  tools?: McpToolDefinition[];
}

/**
 * MCP message request (tool call, etc.)
 */
export interface McpMessageRequest {
  method: "_mcp/message";
  params: {
    connectionId: string;
    method: string;
    id?: string | number;
    params?: unknown;
  };
}

/**
 * MCP message response
 */
export interface McpMessageResponse {
  connectionId: string;
  content?: McpContent[];
  result?: unknown;
  error?: McpError;
}

/**
 * MCP content block
 */
export interface McpContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * MCP error
 */
export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP disconnect notification
 */
export interface McpDisconnectNotification {
  method: "_mcp/disconnect";
  params: {
    connectionId: string;
  };
}

/**
 * MCP tools/list response
 */
export interface McpToolsListResult {
  tools: McpToolDefinition[];
}

/**
 * MCP tool definition
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

/**
 * MCP tools/call request params
 */
export interface McpToolsCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP tools/call response
 */
export interface McpToolsCallResult {
  content: McpContent[];
  isError?: boolean;
}

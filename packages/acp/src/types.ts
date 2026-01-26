/**
 * Types for ACP protocol messages
 *
 * This module re-exports shared types from @thinkwell/protocol and
 * defines ACP-specific types that are not shared with other packages.
 */

// Re-export shared types from protocol package
export type {
  JsonSchema,
  McpContext,
  McpServerConfig,
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
} from "@thinkwell/protocol";

/**
 * Interface for types that can provide a JSON Schema representation.
 *
 * This enables integration with various schema technologies:
 * - Schema-first libraries (Zod, TypeBox)
 * - Build-time type-to-schema generators (TypeSpec, ts-json-schema-transformer)
 * - Hand-written schemas with type associations
 *
 * @typeParam T - The TypeScript type that this schema describes
 */
export interface SchemaProvider<T> {
  /**
   * Returns the JSON Schema that describes type T.
   */
  toJsonSchema(): import("@thinkwell/protocol").JsonSchema;
}

/**
 * Session message types
 */
export type SessionMessage =
  | { type: "text"; content: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string }
  | { type: "stop"; reason: StopReason };

/**
 * Reason for stopping
 */
export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";

/**
 * Tool handler function type
 */
export type ToolHandler<I = unknown, O = unknown> = (
  input: I,
  context: import("@thinkwell/protocol").McpContext
) => Promise<O>;

/**
 * Registered tool with metadata
 */
export interface RegisteredTool<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: import("@thinkwell/protocol").JsonSchema;
  outputSchema: import("@thinkwell/protocol").JsonSchema;
  handler: ToolHandler<I, O>;
}

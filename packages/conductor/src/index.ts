/**
 * @thinkwell/conductor - TypeScript conductor for ACP proxy chains
 *
 * The conductor orchestrates message routing between clients, proxies, and agents.
 * It sits between every component, managing process lifecycle and message flow.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { Conductor, fromCommands, createChannelPair } from '@thinkwell/conductor';
 *
 * // Create a conductor that spawns an agent subprocess
 * const conductor = new Conductor({
 *   instantiator: fromCommands(['my-agent']),
 * });
 *
 * // Connect via a channel (for testing) or stdio (for production)
 * const [clientEnd, conductorEnd] = createChannelPair();
 * await conductor.connect(conductorEnd);
 * ```
 *
 * ## Logging
 *
 * Enable logging to see what the conductor is doing:
 *
 * ```typescript
 * const conductor = new Conductor({
 *   instantiator: fromCommands(['my-agent']),
 *   logging: {
 *     level: 'debug', // 'error' | 'warn' | 'info' | 'debug' | 'trace'
 *     name: 'my-app',
 *   },
 * });
 * ```
 *
 * ## JSONL Tracing
 *
 * Write all messages to a JSONL file for debugging:
 *
 * ```typescript
 * const conductor = new Conductor({
 *   instantiator: fromCommands(['my-agent']),
 *   trace: {
 *     path: '/tmp/conductor-trace.jsonl',
 *   },
 * });
 * ```
 *
 * ## Architecture
 *
 * The conductor uses a central message queue to preserve ordering:
 *
 * ```
 * Client ←→ Conductor ←→ [Proxy 0] ←→ [Proxy 1] ←→ ... ←→ Agent
 * ```
 *
 * All messages flow through the conductor's event loop, ensuring that
 * responses never overtake notifications.
 *
 * @module
 */

// Conductor
export { Conductor, type ConductorConfig } from "./conductor.js";

// Logging
export {
  createLogger,
  createNoopLogger,
  getLogger,
  setLogger,
  type Logger,
  type LoggerOptions,
  type LogLevel,
  type LogEntry,
  type TraceOptions,
  type TraceEntry,
} from "./logger.js";

// Instantiators
export {
  fromCommands,
  fromConnectors,
  dynamic,
  staticInstantiator,
  type CommandSpec,
  type CommandOptions,
  type StaticInstantiatorConfig,
  type DynamicInstantiatorFactory,
} from "./instantiators.js";

// Types
export type {
  RoleId,
  SourceIndex,
  ConductorMessage,
  ComponentConnection,
  ComponentConnector,
  InitializeRequest,
  InstantiatedComponents,
  ComponentInstantiator,
} from "./types.js";

export { ROLE_COUNTERPART } from "./types.js";

// Message queue
export { MessageQueue } from "./message-queue.js";

// Connectors
export {
  StdioConnector,
  stdio,
  ChannelConnector,
  createChannelPair,
  inProcess,
  echoComponent,
  type StdioConnectorOptions,
  type ChannelPair,
  type ComponentHandler,
} from "./connectors/index.js";

// MCP Bridge
export {
  McpBridge,
  createHttpListener,
  type McpBridgeOptions,
  type HttpListener,
  type HttpListenerOptions,
  type McpServerSpec,
  type TransformedMcpServer,
  type McpBridgeListener,
  type McpBridgeConnection,
  type McpBridgeMessage,
} from "./mcp-bridge/index.js";

// Re-export protocol types that are commonly used with the conductor
export type {
  JsonRpcMessage,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcId,
  Dispatch,
  Responder,
  RequestDispatch,
  NotificationDispatch,
  ResponseDispatch,
} from "@thinkwell/protocol";

export {
  isJsonRpcRequest,
  isJsonRpcNotification,
  isJsonRpcResponse,
  createRequest,
  createNotification,
  createSuccessResponse,
  createErrorResponse,
  createResponder,
} from "@thinkwell/protocol";

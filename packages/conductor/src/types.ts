/**
 * Internal types for the conductor
 */

import type { JsonRpcMessage, Dispatch } from "@thinkwell/protocol";

/**
 * Role identifiers for the conductor's connections
 */
export type RoleId = "client" | "agent" | "proxy" | "conductor";

/**
 * Role relationships - encode at runtime what Rust does at compile time
 */
export const ROLE_COUNTERPART: Record<RoleId, RoleId> = {
  client: "agent",
  agent: "client",
  proxy: "conductor",
  conductor: "proxy",
};

/**
 * Index identifying a source component for right-to-left messages
 */
export type SourceIndex = { type: "proxy"; index: number } | { type: "successor" };

/**
 * Messages flowing through the conductor's central queue
 */
export type ConductorMessage =
  | { type: "left-to-right"; targetIndex: number; dispatch: Dispatch }
  | { type: "right-to-left"; sourceIndex: SourceIndex; dispatch: Dispatch }
  | { type: "mcp-connection-received"; acpUrl: string; connectionId: string }
  | {
      type: "mcp-connection-established";
      connectionId: string;
      serverInfo: { name: string; version: string };
    }
  | { type: "mcp-client-to-server"; connectionId: string; dispatch: Dispatch }
  | { type: "mcp-connection-disconnected"; connectionId: string }
  | { type: "shutdown" };

/**
 * A bidirectional connection to a component (client, proxy, or agent)
 */
export interface ComponentConnection {
  /** Send a message to this component */
  send(message: JsonRpcMessage): void;

  /** Receive messages from this component */
  messages: AsyncIterable<JsonRpcMessage>;

  /** Close the connection */
  close(): Promise<void>;
}

/**
 * Factory for creating component connections
 */
export interface ComponentConnector {
  /** Open a bidirectional JSON-RPC connection */
  connect(): Promise<ComponentConnection>;
}

/**
 * ACP initialize request structure
 */
export interface InitializeRequest {
  method: "initialize" | "acp/initialize";
  params?: {
    clientInfo?: {
      name?: string;
      version?: string;
    };
    capabilities?: {
      mcp_acp_transport?: boolean;
      [key: string]: unknown;
    };
    _meta?: {
      proxy?: boolean;
      [key: string]: unknown;
    };
    mcpServers?: Array<{
      name: string;
      url: string;
      type?: string;
    }>;
    [key: string]: unknown;
  };
}

/**
 * Result of component instantiation
 */
export interface InstantiatedComponents {
  proxies: ComponentConnector[];
  agent: ComponentConnector;
}

/**
 * Interface for instantiating components when the first initialize request arrives
 */
export interface ComponentInstantiator {
  instantiate(initRequest: InitializeRequest): Promise<InstantiatedComponents>;
}

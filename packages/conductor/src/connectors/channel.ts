/**
 * ChannelConnector - in-memory bidirectional connection
 *
 * This connector creates an in-memory channel for testing or for
 * embedded components that run in the same process.
 */

import type { JsonRpcMessage } from "@thinkwell/protocol";
import type { ComponentConnection, ComponentConnector } from "../types.js";

/**
 * A simple message channel that supports async iteration
 */
class MessageChannel {
  private queue: JsonRpcMessage[] = [];
  private resolvers: Array<(msg: JsonRpcMessage | null) => void> = [];
  private closed = false;

  push(message: JsonRpcMessage): void {
    if (this.closed) {
      return;
    }

    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(message);
    } else {
      this.queue.push(message);
    }
  }

  close(): void {
    this.closed = true;
    for (const resolve of this.resolvers) {
      resolve(null);
    }
    this.resolvers = [];
  }

  isClosed(): boolean {
    return this.closed;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<JsonRpcMessage> {
    while (!this.closed) {
      let message: JsonRpcMessage | null;

      if (this.queue.length > 0) {
        message = this.queue.shift()!;
      } else {
        message = await new Promise<JsonRpcMessage | null>((resolve) => {
          this.resolvers.push(resolve);
        });
      }

      if (message === null) {
        return;
      }

      yield message;
    }

    // Drain any remaining messages
    while (this.queue.length > 0) {
      yield this.queue.shift()!;
    }
  }
}

/**
 * One side of a channel connection
 */
class ChannelConnectionEnd implements ComponentConnection {
  private readonly sendChannel: MessageChannel;
  private readonly receiveChannel: MessageChannel;

  constructor(sendChannel: MessageChannel, receiveChannel: MessageChannel) {
    this.sendChannel = sendChannel;
    this.receiveChannel = receiveChannel;
  }

  send(message: JsonRpcMessage): void {
    this.sendChannel.push(message);
  }

  get messages(): AsyncIterable<JsonRpcMessage> {
    return this.receiveChannel;
  }

  async close(): Promise<void> {
    this.sendChannel.close();
    this.receiveChannel.close();
  }
}

/**
 * A pair of connected channel endpoints.
 *
 * Messages sent on one end are received on the other.
 */
export interface ChannelPair {
  /** The "left" side of the channel */
  left: ComponentConnection;
  /** The "right" side of the channel */
  right: ComponentConnection;
}

/**
 * Create a connected pair of channel endpoints.
 *
 * This is useful for testing or for connecting in-process components.
 */
export function createChannelPair(): ChannelPair {
  const leftToRight = new MessageChannel();
  const rightToLeft = new MessageChannel();

  return {
    left: new ChannelConnectionEnd(leftToRight, rightToLeft),
    right: new ChannelConnectionEnd(rightToLeft, leftToRight),
  };
}

/**
 * Connector for in-memory channel connections.
 *
 * Each call to connect() returns a new channel pair. The "other" end
 * must be retrieved via getOtherEnd() after calling connect().
 */
export class ChannelConnector implements ComponentConnector {
  private pendingOtherEnd: ComponentConnection | null = null;

  async connect(): Promise<ComponentConnection> {
    const pair = createChannelPair();
    this.pendingOtherEnd = pair.right;
    return pair.left;
  }

  /**
   * Get the other end of the most recently created channel.
   *
   * This must be called after connect() to get the paired endpoint.
   */
  getOtherEnd(): ComponentConnection | null {
    const end = this.pendingOtherEnd;
    this.pendingOtherEnd = null;
    return end;
  }
}

/**
 * Handler function for an in-memory component
 */
export type ComponentHandler = (connection: ComponentConnection) => Promise<void>;

/**
 * Create a connector that runs a handler function in-process.
 *
 * This is useful for testing or for embedding simple components.
 *
 * @param handler - Function that handles the component side of the connection
 * @returns A connector that runs the handler when connect() is called
 */
export function inProcess(handler: ComponentHandler): ComponentConnector {
  return {
    async connect(): Promise<ComponentConnection> {
      const pair = createChannelPair();
      // Start the handler on the other end (don't await it)
      handler(pair.right).catch((error) => {
        console.error("In-process component error:", error);
      });
      return pair.left;
    },
  };
}

/**
 * Create a simple echo component for testing.
 *
 * This component echoes back any request with the same params as the result.
 */
export function echoComponent(): ComponentConnector {
  return inProcess(async (connection) => {
    for await (const message of connection.messages) {
      if ("method" in message && "id" in message) {
        // It's a request - echo the params back as the result
        connection.send({
          jsonrpc: "2.0",
          id: message.id,
          result: message.params,
        });
      }
    }
  });
}

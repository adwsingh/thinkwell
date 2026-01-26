/**
 * Central message queue for the conductor
 *
 * All routing flows through this queue, preserving message ordering.
 * The queue supports async iteration, allowing the conductor's main loop
 * to consume messages as they arrive.
 */

import type { ConductorMessage } from "./types.js";

/**
 * A message queue with async iteration support.
 *
 * Messages can be pushed from multiple sources (client, proxies, agent)
 * and are consumed in order by the conductor's event loop.
 */
export class MessageQueue {
  private queue: ConductorMessage[] = [];
  private resolvers: Array<(msg: ConductorMessage) => void> = [];
  private closed = false;

  /**
   * Push a message onto the queue.
   *
   * If there's a waiting consumer, the message is delivered immediately.
   * Otherwise, it's buffered until the next consumer is ready.
   */
  push(message: ConductorMessage): void {
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

  /**
   * Close the queue, causing the async iterator to complete.
   */
  close(): void {
    this.closed = true;
    // Wake up any waiting consumers so they can exit
    for (const resolve of this.resolvers) {
      // Push a shutdown message to signal completion
      resolve({ type: "shutdown" });
    }
    this.resolvers = [];
  }

  /**
   * Check if the queue has been closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Async iterator for consuming messages.
   *
   * This allows the conductor to use `for await` to process messages:
   * ```typescript
   * for await (const msg of messageQueue) {
   *   await handleMessage(msg);
   * }
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncIterator<ConductorMessage> {
    while (!this.closed) {
      let message: ConductorMessage;

      if (this.queue.length > 0) {
        message = this.queue.shift()!;
      } else {
        message = await new Promise<ConductorMessage>((resolve) => {
          this.resolvers.push(resolve);
        });
      }

      // Check for shutdown message
      if (message.type === "shutdown") {
        return;
      }

      yield message;
    }

    // Drain any remaining messages in the queue
    while (this.queue.length > 0) {
      const message = this.queue.shift()!;
      if (message.type !== "shutdown") {
        yield message;
      }
    }
  }
}

/**
 * Tests for the Conductor class
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { Conductor, fromConnectors } from "./conductor.js";
import { createChannelPair, inProcess } from "./connectors/channel.js";
import type { ComponentConnection, ComponentConnector } from "./types.js";
import type { JsonRpcMessage } from "@thinkwell/protocol";
import {
  PROXY_SUCCESSOR_REQUEST,
  PROXY_SUCCESSOR_NOTIFICATION,
} from "@thinkwell/protocol";

/**
 * Create a simple mock agent that responds to requests
 */
function createMockAgent(
  handler: (message: JsonRpcMessage, send: (msg: JsonRpcMessage) => void) => void
): ComponentConnector {
  return inProcess(async (connection) => {
    for await (const message of connection.messages) {
      handler(message, (msg) => connection.send(msg));
    }
  });
}

/**
 * Create an echo agent that echoes request params back as result
 */
function createEchoAgent(): ComponentConnector {
  return createMockAgent((message, send) => {
    if ("method" in message && "id" in message) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: message.params,
      });
    }
  });
}

/**
 * Create a connector for a client that we control
 */
function createTestClient(): {
  connector: ComponentConnector;
  clientSend: (msg: JsonRpcMessage) => void;
  receivedMessages: JsonRpcMessage[];
  waitForMessage: () => Promise<JsonRpcMessage>;
} {
  const receivedMessages: JsonRpcMessage[] = [];
  let messageResolve: ((msg: JsonRpcMessage) => void) | null = null;

  const pair = createChannelPair();

  // Track messages received from conductor
  (async () => {
    for await (const message of pair.right.messages) {
      receivedMessages.push(message);
      if (messageResolve) {
        messageResolve(message);
        messageResolve = null;
      }
    }
  })();

  return {
    connector: {
      async connect() {
        return pair.left;
      },
    },
    clientSend: (msg) => pair.right.send(msg),
    receivedMessages,
    waitForMessage: () =>
      new Promise<JsonRpcMessage>((resolve) => {
        if (receivedMessages.length > 0) {
          resolve(receivedMessages[receivedMessages.length - 1]);
        } else {
          messageResolve = resolve;
        }
      }),
  };
}

describe("Conductor", () => {
  describe("pass-through mode (no proxies)", () => {
    it("should forward initialize request to agent and return response", async () => {
      const initResponse = {
        serverInfo: { name: "test-agent", version: "1.0" },
        capabilities: { tools: true },
      };

      const agent = createMockAgent((message, send) => {
        if ("method" in message && message.method === "initialize") {
          send({
            jsonrpc: "2.0",
            id: message.id,
            result: initResponse,
          });
        }
      });

      const conductor = new Conductor({
        instantiator: fromConnectors(agent),
      });

      const { connector, clientSend, waitForMessage, receivedMessages } = createTestClient();

      // Start conductor (don't await - it runs forever)
      const conductorPromise = conductor.connect(connector);

      // Send initialize request
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "test-client", version: "1.0" } },
      });

      // Wait for response
      const response = await waitForMessage();

      assert.equal(response.jsonrpc, "2.0");
      assert.equal((response as any).id, 1);
      assert.deepEqual((response as any).result, initResponse);

      // Shut down
      await conductor.shutdown();
    });

    it("should forward subsequent requests to agent", async () => {
      const agent = createEchoAgent();

      const conductor = new Conductor({
        instantiator: fromConnectors(agent),
      });

      const { connector, clientSend, waitForMessage, receivedMessages } = createTestClient();

      const conductorPromise = conductor.connect(connector);

      // Initialize first
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "test", version: "1.0" } },
      });
      await waitForMessage();

      // Now send another request
      clientSend({
        jsonrpc: "2.0",
        id: 2,
        method: "some/method",
        params: { foo: "bar" },
      });

      // Wait for the echo response
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = receivedMessages.find((m) => (m as any).id === 2);
      assert.ok(response, "Should have received response for id 2");
      assert.deepEqual((response as any).result, { foo: "bar" });

      await conductor.shutdown();
    });

    it("should forward notifications to agent", async () => {
      const receivedNotifications: JsonRpcMessage[] = [];

      const agent = createMockAgent((message, send) => {
        if ("method" in message && !("id" in message)) {
          receivedNotifications.push(message);
        } else if ("method" in message && message.method === "initialize") {
          send({ jsonrpc: "2.0", id: message.id, result: {} });
        }
      });

      const conductor = new Conductor({
        instantiator: fromConnectors(agent),
      });

      const { connector, clientSend, waitForMessage } = createTestClient();

      const conductorPromise = conductor.connect(connector);

      // Initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });
      await waitForMessage();

      // Send notification
      clientSend({
        jsonrpc: "2.0",
        method: "some/notification",
        params: { data: 123 },
      });

      // Give time for the notification to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(receivedNotifications.length, 1);
      assert.equal((receivedNotifications[0] as any).method, "some/notification");
      assert.deepEqual((receivedNotifications[0] as any).params, { data: 123 });

      await conductor.shutdown();
    });

    it("should forward notifications from agent to client", async () => {
      let agentConnection: ComponentConnection | null = null;

      const agent: ComponentConnector = {
        async connect() {
          const pair = createChannelPair();
          agentConnection = pair.right;

          // Handle initialization on the agent side
          (async () => {
            for await (const message of pair.right.messages) {
              if ("method" in message && message.method === "initialize") {
                pair.right.send({ jsonrpc: "2.0", id: message.id, result: {} });
              }
            }
          })();

          return pair.left;
        },
      };

      const conductor = new Conductor({
        instantiator: fromConnectors(agent),
      });

      const { connector, clientSend, receivedMessages } = createTestClient();

      const conductorPromise = conductor.connect(connector);

      // Initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Agent sends notification to client
      agentConnection!.send({
        jsonrpc: "2.0",
        method: "agent/notification",
        params: { status: "working" },
      });

      // Wait for notification to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      const notification = receivedMessages.find(
        (m) => "method" in m && m.method === "agent/notification"
      );
      assert.ok(notification, "Should have received notification from agent");
      assert.deepEqual((notification as any).params, { status: "working" });

      await conductor.shutdown();
    });
  });

  describe("request/response correlation", () => {
    it("should correctly route concurrent responses back to original requesters", async () => {
      // Agent that responds with a delay, in reverse order
      const agent: ComponentConnector = inProcess(async (connection) => {
        const pending: Array<{ id: any; delay: number }> = [];

        for await (const message of connection.messages) {
          if ("method" in message && "id" in message) {
            if (message.method === "initialize") {
              connection.send({ jsonrpc: "2.0", id: message.id, result: {} });
            } else if (message.method === "slow") {
              // Respond after 100ms
              setTimeout(() => {
                connection.send({
                  jsonrpc: "2.0",
                  id: message.id,
                  result: { order: "slow" },
                });
              }, 100);
            } else if (message.method === "fast") {
              // Respond immediately
              connection.send({
                jsonrpc: "2.0",
                id: message.id,
                result: { order: "fast" },
              });
            }
          }
        }
      });

      const conductor = new Conductor({
        instantiator: fromConnectors(agent),
      });

      const { connector, clientSend, receivedMessages } = createTestClient();

      conductor.connect(connector);

      // Initialize
      clientSend({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Send slow request first, then fast request
      clientSend({ jsonrpc: "2.0", id: 2, method: "slow", params: {} });
      clientSend({ jsonrpc: "2.0", id: 3, method: "fast", params: {} });

      // Wait for both responses
      await new Promise((resolve) => setTimeout(resolve, 200));

      const slowResponse = receivedMessages.find((m) => (m as any).id === 2);
      const fastResponse = receivedMessages.find((m) => (m as any).id === 3);

      assert.ok(slowResponse, "Should have received slow response");
      assert.ok(fastResponse, "Should have received fast response");
      assert.deepEqual((slowResponse as any).result, { order: "slow" });
      assert.deepEqual((fastResponse as any).result, { order: "fast" });

      await conductor.shutdown();
    });
  });

  describe("proxy support", () => {
    /**
     * Create a simple pass-through proxy that accepts proxy capability
     * and forwards all messages to its successor using _proxy/successor/*
     *
     * This proxy handles:
     * - Requests from client (left-to-right): forwards via _proxy/successor/request
     * - Notifications from client: forwards via _proxy/successor/notification
     * - _proxy/successor/request from conductor (right-to-left): unwraps and sends to client
     * - _proxy/successor/notification from conductor: unwraps and sends to client
     */
    function createPassThroughProxy(): ComponentConnector {
      return inProcess(async (connection) => {
        // Track pending requests so we can match responses
        const pendingRequests = new Map<string, { originalId: any }>();

        for await (const message of connection.messages) {
          if ("method" in message && "id" in message) {
            if (message.method === PROXY_SUCCESSOR_REQUEST) {
              // This is from the conductor - a message FROM the successor TO us
              // We need to unwrap it and send to our predecessor (client)
              const params = message.params as { method: string; params: unknown };

              // For requests from successor, we track and forward
              const proxyId = `from-successor-${message.id}`;
              pendingRequests.set(proxyId, { originalId: message.id });

              connection.send({
                jsonrpc: "2.0",
                id: proxyId,
                method: params.method,
                params: params.params,
              });
            } else if (message.method === "initialize") {
              // Check for proxy capability offer
              const params = message.params as any;
              const hasProxyOffer = params?._meta?.proxy === true;

              if (hasProxyOffer) {
                // Track this request
                const proxyId = `proxy-${message.id}`;
                pendingRequests.set(proxyId, { originalId: message.id });

                // Forward to successor using _proxy/successor/request
                connection.send({
                  jsonrpc: "2.0",
                  id: proxyId,
                  method: PROXY_SUCCESSOR_REQUEST,
                  params: {
                    method: message.method,
                    params: message.params,
                  },
                });
              } else {
                // No proxy offer - just respond with basic capabilities
                connection.send({
                  jsonrpc: "2.0",
                  id: message.id,
                  result: { serverInfo: { name: "proxy", version: "1.0" } },
                });
              }
            } else {
              // Forward all other requests to successor
              const proxyId = `proxy-${message.id}`;
              pendingRequests.set(proxyId, { originalId: message.id });

              connection.send({
                jsonrpc: "2.0",
                id: proxyId,
                method: PROXY_SUCCESSOR_REQUEST,
                params: {
                  method: message.method,
                  params: message.params,
                },
              });
            }
          } else if ("method" in message && !("id" in message)) {
            if (message.method === PROXY_SUCCESSOR_NOTIFICATION) {
              // Notification from successor - unwrap and forward to client
              const params = message.params as { method: string; params: unknown };
              connection.send({
                jsonrpc: "2.0",
                method: params.method,
                params: params.params,
              });
            } else {
              // Forward client notifications to successor
              connection.send({
                jsonrpc: "2.0",
                method: PROXY_SUCCESSOR_NOTIFICATION,
                params: {
                  method: message.method,
                  params: message.params,
                },
              });
            }
          } else if ("result" in message || "error" in message) {
            // Response - find the pending request and respond
            const pending = pendingRequests.get(String((message as any).id));
            if (pending) {
              pendingRequests.delete(String((message as any).id));

              if ("result" in message) {
                const result = (message as any).result;
                connection.send({
                  jsonrpc: "2.0",
                  id: pending.originalId,
                  result: {
                    ...result,
                    _meta: { ...result?._meta, proxy: true },
                  },
                });
              } else {
                connection.send({
                  jsonrpc: "2.0",
                  id: pending.originalId,
                  error: (message as any).error,
                });
              }
            }
          }
        }
      });
    }

    /**
     * Create a transforming proxy that modifies requests
     */
    function createTransformingProxy(
      transform: (method: string, params: unknown) => { method: string; params: unknown }
    ): ComponentConnector {
      return inProcess(async (connection) => {
        const pendingRequests = new Map<
          string,
          { originalId: any; wasInitialize: boolean }
        >();

        for await (const message of connection.messages) {
          if ("method" in message && "id" in message) {
            if (message.method === "initialize") {
              const params = message.params as any;
              const hasProxyOffer = params?._meta?.proxy === true;

              // Store the request info
              const proxyId = `proxy-${message.id}`;
              pendingRequests.set(proxyId, {
                originalId: message.id,
                wasInitialize: true,
              });

              // Forward (possibly transformed) request to successor
              connection.send({
                jsonrpc: "2.0",
                id: proxyId,
                method: PROXY_SUCCESSOR_REQUEST,
                params: {
                  method: message.method,
                  params: message.params,
                },
              });
            } else {
              const proxyId = `proxy-${message.id}`;
              pendingRequests.set(proxyId, {
                originalId: message.id,
                wasInitialize: false,
              });

              // Transform and forward
              const transformed = transform(message.method, message.params);
              connection.send({
                jsonrpc: "2.0",
                id: proxyId,
                method: PROXY_SUCCESSOR_REQUEST,
                params: transformed,
              });
            }
          } else if ("result" in message || "error" in message) {
            const pending = pendingRequests.get(String((message as any).id));
            if (pending) {
              pendingRequests.delete(String((message as any).id));

              if ("result" in message) {
                const result = (message as any).result;
                connection.send({
                  jsonrpc: "2.0",
                  id: pending.originalId,
                  result: pending.wasInitialize
                    ? { ...result, _meta: { ...result?._meta, proxy: true } }
                    : result,
                });
              } else {
                connection.send({
                  jsonrpc: "2.0",
                  id: pending.originalId,
                  error: (message as any).error,
                });
              }
            }
          }
        }
      });
    }

    it("should route messages through a single proxy", async () => {
      const agentReceivedMethods: string[] = [];

      const agent = createMockAgent((message, send) => {
        if ("method" in message) {
          agentReceivedMethods.push(message.method);
        }
        if ("method" in message && "id" in message) {
          if (message.method === "initialize") {
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                serverInfo: { name: "test-agent", version: "1.0" },
                capabilities: {},
              },
            });
          } else {
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: { received: message.method },
            });
          }
        }
      });

      const proxy = createPassThroughProxy();

      const conductor = new Conductor({
        instantiator: fromConnectors(agent, [proxy]),
      });

      const { connector, clientSend, waitForMessage, receivedMessages } =
        createTestClient();

      conductor.connect(connector);

      // Send initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "test", version: "1.0" } },
      });

      const initResponse = await waitForMessage();
      assert.equal((initResponse as any).id, 1);
      assert.ok((initResponse as any).result, "Should have result");

      // Send a regular request
      clientSend({
        jsonrpc: "2.0",
        id: 2,
        method: "test/method",
        params: { data: "hello" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const methodResponse = receivedMessages.find((m) => (m as any).id === 2);
      assert.ok(methodResponse, "Should have received response for test/method");
      // Note: proxy adds _meta.proxy to all responses (simplified test proxy behavior)
      assert.equal(
        (methodResponse as any).result.received,
        "test/method",
        "Response should contain the method name"
      );

      // Verify agent received the methods
      assert.ok(
        agentReceivedMethods.includes("initialize"),
        "Agent should have received initialize"
      );
      assert.ok(
        agentReceivedMethods.includes("test/method"),
        "Agent should have received test/method"
      );

      await conductor.shutdown();
    });

    it("should verify proxy capability handshake", async () => {
      // Create a proxy that does NOT accept the proxy capability
      const nonProxyComponent = createMockAgent((message, send) => {
        if ("method" in message && "id" in message) {
          if (message.method === "initialize") {
            // Respond WITHOUT proxy: true in _meta
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                serverInfo: { name: "non-proxy", version: "1.0" },
                // Missing _meta.proxy: true
              },
            });
          }
        }
      });

      const agent = createEchoAgent();

      const conductor = new Conductor({
        instantiator: fromConnectors(agent, [nonProxyComponent]),
      });

      const { connector, clientSend, waitForMessage } = createTestClient();

      conductor.connect(connector);

      // Send initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });

      const response = await waitForMessage();

      // Should get an error because the component didn't accept proxy capability
      assert.ok((response as any).error, "Should have received error");
      assert.ok(
        (response as any).error.message.includes("proxy capability"),
        "Error should mention proxy capability"
      );

      await conductor.shutdown();
    });

    it("should forward notifications through proxy chain", async () => {
      const agentReceivedNotifications: JsonRpcMessage[] = [];

      const agent: ComponentConnector = inProcess(async (connection) => {
        for await (const message of connection.messages) {
          if ("method" in message && !("id" in message)) {
            agentReceivedNotifications.push(message);
          } else if ("method" in message && "id" in message) {
            if (message.method === "initialize") {
              connection.send({
                jsonrpc: "2.0",
                id: message.id,
                result: { serverInfo: { name: "agent", version: "1.0" } },
              });
            }
          }
        }
      });

      const proxy = createPassThroughProxy();

      const conductor = new Conductor({
        instantiator: fromConnectors(agent, [proxy]),
      });

      const { connector, clientSend, waitForMessage } = createTestClient();

      conductor.connect(connector);

      // Initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });
      await waitForMessage();

      // Send notification
      clientSend({
        jsonrpc: "2.0",
        method: "test/notification",
        params: { data: "test-data" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      assert.equal(agentReceivedNotifications.length, 1);
      assert.equal(
        (agentReceivedNotifications[0] as any).method,
        "test/notification"
      );
      assert.deepEqual((agentReceivedNotifications[0] as any).params, {
        data: "test-data",
      });

      await conductor.shutdown();
    });

    it("should route notifications from agent back through proxy chain to client", async () => {
      let agentConnection: ComponentConnection | null = null;

      const agent: ComponentConnector = {
        async connect() {
          const pair = createChannelPair();
          agentConnection = pair.right;

          // Handle messages on the agent side
          (async () => {
            for await (const message of pair.right.messages) {
              if ("method" in message && "id" in message) {
                if (message.method === "initialize") {
                  pair.right.send({
                    jsonrpc: "2.0",
                    id: message.id,
                    result: { serverInfo: { name: "agent", version: "1.0" } },
                  });
                }
              }
            }
          })();

          return pair.left;
        },
      };

      const proxy = createPassThroughProxy();

      const conductor = new Conductor({
        instantiator: fromConnectors(agent, [proxy]),
      });

      const { connector, clientSend, waitForMessage, receivedMessages } =
        createTestClient();

      conductor.connect(connector);

      // Initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });
      await waitForMessage();

      // Agent sends a notification
      agentConnection!.send({
        jsonrpc: "2.0",
        method: "agent/status",
        params: { status: "working" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const notification = receivedMessages.find(
        (m) => "method" in m && m.method === "agent/status"
      );
      assert.ok(notification, "Should have received notification from agent");
      assert.deepEqual((notification as any).params, { status: "working" });

      await conductor.shutdown();
    });

    it("should route messages through multiple proxies", async () => {
      const agentReceivedMethods: string[] = [];

      const agent = createMockAgent((message, send) => {
        if ("method" in message) {
          agentReceivedMethods.push(message.method);
        }
        if ("method" in message && "id" in message) {
          if (message.method === "initialize") {
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                serverInfo: { name: "agent", version: "1.0" },
              },
            });
          } else {
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: { finalResult: "from-agent" },
            });
          }
        }
      });

      // Create two proxies
      const proxy1 = createPassThroughProxy();
      const proxy2 = createPassThroughProxy();

      const conductor = new Conductor({
        instantiator: fromConnectors(agent, [proxy1, proxy2]),
      });

      const { connector, clientSend, waitForMessage, receivedMessages } =
        createTestClient();

      conductor.connect(connector);

      // Initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "test", version: "1.0" } },
      });

      const initResponse = await waitForMessage();
      assert.equal((initResponse as any).id, 1);
      assert.ok((initResponse as any).result, "Should have init result");

      // Send a request that should go through both proxies
      clientSend({
        jsonrpc: "2.0",
        id: 2,
        method: "test/multi-proxy",
        params: { data: "test" },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const response = receivedMessages.find((m) => (m as any).id === 2);
      assert.ok(response, "Should have received response");
      assert.equal(
        (response as any).result.finalResult,
        "from-agent",
        "Response should be from agent"
      );

      // Verify the message went through to the agent
      assert.ok(
        agentReceivedMethods.includes("test/multi-proxy"),
        "Agent should have received the method"
      );

      await conductor.shutdown();
    });

    it("should support transforming proxy that modifies requests", async () => {
      const agentReceivedParams: any[] = [];

      const agent = createMockAgent((message, send) => {
        if ("method" in message && "id" in message) {
          if (message.method === "initialize") {
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: { serverInfo: { name: "agent", version: "1.0" } },
            });
          } else {
            agentReceivedParams.push(message.params);
            send({
              jsonrpc: "2.0",
              id: message.id,
              result: { ok: true },
            });
          }
        }
      });

      // Proxy that adds a "transformed: true" field to all params
      const transformingProxy = createTransformingProxy((method, params) => ({
        method,
        params: { ...(params as object), transformed: true },
      }));

      const conductor = new Conductor({
        instantiator: fromConnectors(agent, [transformingProxy]),
      });

      const { connector, clientSend, waitForMessage, receivedMessages } =
        createTestClient();

      conductor.connect(connector);

      // Initialize
      clientSend({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      });
      await waitForMessage();

      // Send a request that will be transformed
      clientSend({
        jsonrpc: "2.0",
        id: 2,
        method: "test/method",
        params: { original: "data" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the agent received the transformed params
      assert.equal(agentReceivedParams.length, 1);
      assert.deepEqual(agentReceivedParams[0], {
        original: "data",
        transformed: true,
      });

      await conductor.shutdown();
    });
  });
});

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  convertNotification,
  convertContentBlock,
  convertToolCallContent,
} from "./agent.js";
import type { SessionNotification } from "@agentclientprotocol/sdk";

/**
 * Helper to wrap an ACP SessionUpdate in a SessionNotification envelope.
 */
function notification(update: SessionNotification["update"]): SessionNotification {
  return { sessionId: "test-session", update };
}

describe("convertNotification", () => {
  describe("agent_thought_chunk", () => {
    it("should map text content to a thought event", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: "Let me think about this..." },
        })
      );

      assert.deepStrictEqual(result, {
        type: "thought",
        text: "Let me think about this...",
      });
    });

    it("should return null for non-text content", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "agent_thought_chunk",
          content: { type: "image", data: "abc", mimeType: "image/png" },
        })
      );

      assert.strictEqual(result, null);
    });
  });

  describe("agent_message_chunk", () => {
    it("should map text content to a message event", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Hello, user!" },
        })
      );

      assert.deepStrictEqual(result, {
        type: "message",
        text: "Hello, user!",
      });
    });

    it("should return null for non-text content", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "agent_message_chunk",
          content: { type: "image", data: "abc", mimeType: "image/png" },
        })
      );

      assert.strictEqual(result, null);
    });
  });

  describe("tool_call", () => {
    it("should map to a tool_start event", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call",
          toolCallId: "tc-1",
          title: "Reading file",
          kind: "read",
        })
      );

      assert.deepStrictEqual(result, {
        type: "tool_start",
        id: "tc-1",
        title: "Reading file",
        kind: "read",
      });
    });

    it("should handle missing kind", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call",
          toolCallId: "tc-2",
          title: "Unknown tool",
        })
      );

      assert.deepStrictEqual(result, {
        type: "tool_start",
        id: "tc-2",
        title: "Unknown tool",
        kind: undefined,
      });
    });
  });

  describe("tool_call_update", () => {
    it("should map in-progress status to tool_update", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
          status: "in_progress",
        })
      );

      assert.deepStrictEqual(result, {
        type: "tool_update",
        id: "tc-1",
        status: "in_progress",
        content: undefined,
      });
    });

    it("should default missing status to 'in_progress'", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
        })
      );

      assert.ok(result);
      assert.strictEqual(result.type, "tool_update");
      if (result.type === "tool_update") {
        assert.strictEqual(result.status, "in_progress");
      }
    });

    it("should map completed status to tool_done", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
          status: "completed",
        })
      );

      assert.deepStrictEqual(result, {
        type: "tool_done",
        id: "tc-1",
        status: "completed",
      });
    });

    it("should map failed status to tool_done", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
          status: "failed",
        })
      );

      assert.deepStrictEqual(result, {
        type: "tool_done",
        id: "tc-1",
        status: "failed",
      });
    });

    it("should convert tool call content", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
          status: "in_progress",
          content: [
            {
              type: "content",
              content: { type: "text", text: "output line 1" },
            },
          ],
        })
      );

      assert.ok(result);
      assert.strictEqual(result.type, "tool_update");
      if (result.type === "tool_update") {
        assert.strictEqual(result.content?.length, 1);
        assert.deepStrictEqual(result.content![0], {
          type: "content",
          content: { type: "text", text: "output line 1" },
        });
      }
    });

    it("should convert diff content", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
          status: "in_progress",
          content: [
            {
              type: "diff",
              path: "/src/foo.ts",
              oldText: "const x = 1;",
              newText: "const x = 2;",
            },
          ],
        })
      );

      assert.ok(result);
      assert.strictEqual(result.type, "tool_update");
      if (result.type === "tool_update") {
        assert.deepStrictEqual(result.content![0], {
          type: "diff",
          path: "/src/foo.ts",
          oldText: "const x = 1;",
          newText: "const x = 2;",
        });
      }
    });

    it("should convert terminal content", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "tool_call_update",
          toolCallId: "tc-1",
          status: "in_progress",
          content: [{ type: "terminal", terminalId: "term-42" }],
        })
      );

      assert.ok(result);
      assert.strictEqual(result.type, "tool_update");
      if (result.type === "tool_update") {
        assert.deepStrictEqual(result.content![0], {
          type: "terminal",
          terminalId: "term-42",
        });
      }
    });
  });

  describe("plan", () => {
    it("should map plan entries", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "plan",
          entries: [
            { content: "Analyze code", status: "completed", priority: "high" },
            { content: "Write tests", status: "in_progress", priority: "medium" },
            { content: "Deploy", status: "pending", priority: "low" },
          ],
        })
      );

      assert.deepStrictEqual(result, {
        type: "plan",
        entries: [
          { content: "Analyze code", status: "completed", priority: "high" },
          { content: "Write tests", status: "in_progress", priority: "medium" },
          { content: "Deploy", status: "pending", priority: "low" },
        ],
      });
    });

    it("should handle empty entries", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "plan",
          entries: [],
        })
      );

      assert.deepStrictEqual(result, { type: "plan", entries: [] });
    });
  });

  describe("filtered update types", () => {
    it("should return null for user_message_chunk", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "user input" },
        })
      );
      assert.strictEqual(result, null);
    });

    it("should return null for available_commands_update", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "available_commands_update",
          availableCommands: [],
        })
      );
      assert.strictEqual(result, null);
    });

    it("should return null for current_mode_update", () => {
      const result = convertNotification(
        notification({
          sessionUpdate: "current_mode_update",
          currentModeId: "code",
        })
      );
      assert.strictEqual(result, null);
    });
  });
});

describe("convertContentBlock", () => {
  it("should convert text blocks", () => {
    const result = convertContentBlock({ type: "text", text: "hello" });
    assert.deepStrictEqual(result, { type: "text", text: "hello" });
  });

  it("should convert image blocks", () => {
    const result = convertContentBlock({
      type: "image",
      data: "base64data",
      mimeType: "image/png",
    });
    assert.deepStrictEqual(result, {
      type: "image",
      data: "base64data",
      mimeType: "image/png",
    });
  });

  it("should convert resource_link blocks", () => {
    const result = convertContentBlock({
      type: "resource_link",
      uri: "file:///foo.ts",
      name: "foo.ts",
    });
    assert.deepStrictEqual(result, {
      type: "resource_link",
      uri: "file:///foo.ts",
      name: "foo.ts",
    });
  });

  it("should convert resource_link without optional name", () => {
    const result = convertContentBlock({
      type: "resource_link",
      uri: "file:///bar.ts",
    });
    assert.deepStrictEqual(result, {
      type: "resource_link",
      uri: "file:///bar.ts",
      name: undefined,
    });
  });

  it("should return null for unsupported block types", () => {
    // audio type exists in ACP but is not mapped
    const result = convertContentBlock({
      type: "audio",
      data: "base64",
      mimeType: "audio/wav",
    } as any);
    assert.strictEqual(result, null);
  });
});

describe("convertToolCallContent", () => {
  it("should convert content with text block", () => {
    const result = convertToolCallContent({
      type: "content",
      content: { type: "text", text: "output" },
    });
    assert.deepStrictEqual(result, {
      type: "content",
      content: { type: "text", text: "output" },
    });
  });

  it("should convert diff content", () => {
    const result = convertToolCallContent({
      type: "diff",
      path: "/file.ts",
      oldText: "old",
      newText: "new",
    });
    assert.deepStrictEqual(result, {
      type: "diff",
      path: "/file.ts",
      oldText: "old",
      newText: "new",
    });
  });

  it("should default missing oldText to empty string", () => {
    const result = convertToolCallContent({
      type: "diff",
      path: "/new-file.ts",
      newText: "content",
    } as any);
    assert.ok(result);
    if (result.type === "diff") {
      assert.strictEqual(result.oldText, "");
    }
  });

  it("should convert terminal content", () => {
    const result = convertToolCallContent({
      type: "terminal",
      terminalId: "t-1",
    });
    assert.deepStrictEqual(result, { type: "terminal", terminalId: "t-1" });
  });

  it("should return null for content with unsupported block type", () => {
    const result = convertToolCallContent({
      type: "content",
      content: { type: "audio", data: "abc", mimeType: "audio/wav" } as any,
    });
    assert.strictEqual(result, null);
  });
});

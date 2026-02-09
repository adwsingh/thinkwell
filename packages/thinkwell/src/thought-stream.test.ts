import { describe, it } from "node:test";
import assert from "node:assert";
import { ThoughtStream } from "./thought-stream.js";
import type { ThoughtEvent } from "./thought-event.js";

describe("ThoughtStream", () => {
  describe("async iteration", () => {
    it("should yield events pushed before iteration starts", async () => {
      const stream = new ThoughtStream<string>();
      stream.pushEvent({ type: "thought", text: "hello" });
      stream.pushEvent({ type: "message", text: "world" });
      stream.close();

      const events: ThoughtEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      assert.strictEqual(events.length, 2);
      assert.deepStrictEqual(events[0], { type: "thought", text: "hello" });
      assert.deepStrictEqual(events[1], { type: "message", text: "world" });
    });

    it("should yield events pushed during iteration", async () => {
      const stream = new ThoughtStream<string>();

      // Push events asynchronously
      setTimeout(() => {
        stream.pushEvent({ type: "thought", text: "first" });
        stream.pushEvent({ type: "message", text: "second" });
        stream.close();
      }, 10);

      const events: ThoughtEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      assert.strictEqual(events.length, 2);
      assert.deepStrictEqual(events[0], { type: "thought", text: "first" });
      assert.deepStrictEqual(events[1], { type: "message", text: "second" });
    });

    it("should yield no events when closed immediately", async () => {
      const stream = new ThoughtStream<string>();
      stream.close();

      const events: ThoughtEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      assert.strictEqual(events.length, 0);
    });

    it("should ignore events pushed after close", async () => {
      const stream = new ThoughtStream<string>();
      stream.pushEvent({ type: "thought", text: "before" });
      stream.close();
      stream.pushEvent({ type: "thought", text: "after" });

      const events: ThoughtEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      assert.strictEqual(events.length, 1);
      assert.deepStrictEqual(events[0], { type: "thought", text: "before" });
    });

    it("should handle interleaved push and consume", async () => {
      const stream = new ThoughtStream<string>();
      const events: ThoughtEvent[] = [];

      // Start iterating
      const iterPromise = (async () => {
        for await (const event of stream) {
          events.push(event);
        }
      })();

      // Push events with delays to ensure consumer is waiting
      await new Promise((r) => setTimeout(r, 10));
      stream.pushEvent({ type: "thought", text: "a" });
      await new Promise((r) => setTimeout(r, 10));
      stream.pushEvent({ type: "message", text: "b" });
      await new Promise((r) => setTimeout(r, 10));
      stream.pushEvent({ type: "thought", text: "c" });
      stream.close();

      await iterPromise;

      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[0].type, "thought");
      assert.strictEqual(events[1].type, "message");
      assert.strictEqual(events[2].type, "thought");
    });
  });

  describe(".result independence", () => {
    it("should resolve .result independently from iteration", async () => {
      const stream = new ThoughtStream<number>();

      stream.pushEvent({ type: "thought", text: "thinking..." });
      stream.resolveResult(42);
      stream.close();

      // Await result without iterating
      const result = await stream.result;
      assert.strictEqual(result, 42);
    });

    it("should allow iterating without awaiting .result", async () => {
      const stream = new ThoughtStream<number>();

      stream.pushEvent({ type: "thought", text: "a" });
      stream.pushEvent({ type: "message", text: "b" });
      stream.close();
      stream.resolveResult(99);

      // Iterate without ever awaiting .result
      const events: ThoughtEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }

      assert.strictEqual(events.length, 2);
    });

    it("should allow both iteration and .result concurrently", async () => {
      const stream = new ThoughtStream<string>();

      setTimeout(() => {
        stream.pushEvent({ type: "thought", text: "step 1" });
        stream.pushEvent({ type: "message", text: "step 2" });
        stream.resolveResult("done");
        stream.close();
      }, 10);

      const events: ThoughtEvent[] = [];
      const [, result] = await Promise.all([
        (async () => {
          for await (const event of stream) {
            events.push(event);
          }
        })(),
        stream.result,
      ]);

      assert.strictEqual(events.length, 2);
      assert.strictEqual(result, "done");
    });

    it("should reject .result on error", async () => {
      const stream = new ThoughtStream<string>();
      stream.rejectResult(new Error("something broke"));
      stream.close();

      await assert.rejects(stream.result, { message: "something broke" });
    });
  });

  describe("early termination (break from for-await)", () => {
    it("should not break .result when breaking from iteration", async () => {
      const stream = new ThoughtStream<string>();

      setTimeout(() => {
        stream.pushEvent({ type: "thought", text: "a" });
        stream.pushEvent({ type: "thought", text: "b" });
        stream.pushEvent({ type: "thought", text: "c" });
        stream.resolveResult("final");
        // Note: close() not called — iterator.return() handles cleanup
      }, 10);

      // Break after first event
      for await (const event of stream) {
        assert.strictEqual(event.type, "thought");
        break;
      }

      // .result should still resolve
      const result = await stream.result;
      assert.strictEqual(result, "final");
    });

    it("should stop yielding events after break", async () => {
      const stream = new ThoughtStream<number>();

      stream.pushEvent({ type: "thought", text: "1" });
      stream.pushEvent({ type: "thought", text: "2" });
      stream.pushEvent({ type: "thought", text: "3" });

      const events: ThoughtEvent[] = [];
      for await (const event of stream) {
        events.push(event);
        if (events.length === 1) break;
      }

      assert.strictEqual(events.length, 1);

      // Starting a new iteration should yield nothing (stream is done)
      const moreEvents: ThoughtEvent[] = [];
      for await (const event of stream) {
        moreEvents.push(event);
      }
      assert.strictEqual(moreEvents.length, 0);
    });
  });

  describe("fire-and-forget (.result without iterating)", () => {
    it("should resolve .result without any iteration", async () => {
      const stream = new ThoughtStream<{ answer: number }>();

      // Simulate a producer pushing events and resolving
      setTimeout(() => {
        stream.pushEvent({ type: "thought", text: "thinking" });
        stream.pushEvent({ type: "message", text: "here's the answer" });
        stream.resolveResult({ answer: 42 });
        stream.close();
      }, 10);

      // Only await .result — never iterate
      const result = await stream.result;
      assert.deepStrictEqual(result, { answer: 42 });
    });

    it("should buffer events internally when not consumed", async () => {
      const stream = new ThoughtStream<string>();

      // Push many events without consuming
      for (let i = 0; i < 100; i++) {
        stream.pushEvent({ type: "thought", text: `event ${i}` });
      }
      stream.resolveResult("buffered");
      stream.close();

      // Should still resolve
      const result = await stream.result;
      assert.strictEqual(result, "buffered");
    });
  });

  describe("all event types", () => {
    it("should pass through all ThoughtEvent discriminants", async () => {
      const stream = new ThoughtStream<void>();
      const allEvents: ThoughtEvent[] = [
        { type: "thought", text: "hmm" },
        { type: "message", text: "hello" },
        { type: "tool_start", id: "t1", title: "Read file", kind: "read" },
        {
          type: "tool_update",
          id: "t1",
          status: "in_progress",
          content: [{ type: "content", content: { type: "text", text: "data" } }],
        },
        { type: "tool_done", id: "t1", status: "completed" },
        {
          type: "plan",
          entries: [
            { content: "step 1", status: "completed", priority: "high" },
            { content: "step 2", status: "in_progress", priority: "medium" },
          ],
        },
      ];

      for (const event of allEvents) {
        stream.pushEvent(event);
      }
      stream.close();

      const received: ThoughtEvent[] = [];
      for await (const event of stream) {
        received.push(event);
      }

      assert.deepStrictEqual(received, allEvents);
    });
  });
});

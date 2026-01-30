import { describe, test, expect } from "bun:test";
import { findMarkedTypes } from "./transform.js";
import { generateSchemas } from "./schema-generator.js";
import { generateInjections } from "./codegen.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";

describe("integration", () => {
  test("full pipeline: parse, generate schema, inject code", () => {
    // Create a temp file for schema generation
    const tempDir = mkdtempSync(join(tmpdir(), "bun-plugin-test-"));
    const testFile = join(tempDir, "test.ts");

    try {
      const source = `
/** @JSONSchema */
export interface Greeting {
  /** The greeting message */
  message: string;
  /** Optional sender name */
  from?: string;
}
`;
      writeFileSync(testFile, source);

      // Step 1: Find marked types
      const types = findMarkedTypes(testFile, source);
      expect(types).toHaveLength(1);
      expect(types[0].name).toBe("Greeting");

      // Step 2: Generate schemas
      const schemas = generateSchemas(testFile, types);
      expect(schemas.size).toBe(1);

      const schema = schemas.get("Greeting") as Record<string, unknown>;
      expect(schema.type).toBe("object");
      expect(schema.properties).toBeDefined();

      const props = schema.properties as Record<string, unknown>;
      expect(props.message).toEqual({
        type: "string",
        description: "The greeting message",
      });
      expect(props.from).toEqual({
        type: "string",
        description: "Optional sender name",
      });

      expect(schema.required).toEqual(["message"]);

      // Step 3: Generate injections
      const injected = generateInjections(types, schemas);
      expect(injected).toContain("namespace Greeting");
      expect(injected).toContain("SchemaProvider<Greeting>");
      expect(injected).toContain('"The greeting message"');
    } finally {
      // Cleanup
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("handles type alias", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "bun-plugin-test-"));
    const testFile = join(tempDir, "test.ts");

    try {
      const source = `
/** @JSONSchema */
export type Status = "active" | "inactive" | "pending";
`;
      writeFileSync(testFile, source);

      const types = findMarkedTypes(testFile, source);
      expect(types).toHaveLength(1);

      const schemas = generateSchemas(testFile, types);
      const schema = schemas.get("Status") as Record<string, unknown>;

      expect(schema.type).toBe("string");
      expect(schema.enum).toEqual(["active", "inactive", "pending"]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("handles complex nested types", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "bun-plugin-test-"));
    const testFile = join(tempDir, "test.ts");

    try {
      const source = `
/** @JSONSchema */
export interface User {
  name: string;
  address: {
    street: string;
    city: string;
  };
  tags: string[];
}
`;
      writeFileSync(testFile, source);

      const types = findMarkedTypes(testFile, source);
      expect(types).toHaveLength(1);

      const schemas = generateSchemas(testFile, types);
      const schema = schemas.get("User") as Record<string, unknown>;

      expect(schema.type).toBe("object");

      const props = schema.properties as Record<string, unknown>;
      expect(props.name).toEqual({ type: "string" });

      const address = props.address as Record<string, unknown>;
      expect(address.type).toBe("object");
      expect(address.properties).toBeDefined();

      const tags = props.tags as Record<string, unknown>;
      expect(tags.type).toBe("array");
      expect((tags.items as Record<string, unknown>).type).toBe("string");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

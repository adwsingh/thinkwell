/**
 * Schema generation using ts-json-schema-generator.
 */

import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { createGenerator, type Config } from "ts-json-schema-generator";
import type { TypeInfo } from "./transform.js";

/**
 * Find tsconfig.json by walking up from the given directory.
 */
function findTsConfig(startDir: string): string | undefined {
  let dir = startDir;
  while (true) {
    const configPath = join(dir, "tsconfig.json");
    if (existsSync(configPath)) {
      return configPath;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/**
 * Recursively inline $ref references to make schemas self-contained.
 *
 * ts-json-schema-generator produces schemas with $ref references to
 * a definitions section. For our use case (injecting schemas inline),
 * we need self-contained schemas without external references.
 */
function inlineRefs(
  obj: unknown,
  definitions: Record<string, unknown>
): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => inlineRefs(item, definitions));
  }

  const record = obj as Record<string, unknown>;

  // If this object has a $ref, replace it with the referenced definition
  if (typeof record["$ref"] === "string") {
    const ref = record["$ref"];
    const match = ref.match(/^#\/definitions\/(.+)$/);
    if (match && definitions[match[1]]) {
      return inlineRefs(definitions[match[1]], definitions);
    }
  }

  // Otherwise, recursively process all properties
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = inlineRefs(value, definitions);
  }
  return result;
}

/**
 * Generate JSON schemas for the given types using ts-json-schema-generator.
 *
 * @param path - The path to the TypeScript file
 * @param types - The types to generate schemas for
 * @returns Map from type name to JSON schema object
 */
export function generateSchemas(
  path: string,
  types: TypeInfo[]
): Map<string, object> {
  const schemas = new Map<string, object>();

  if (types.length === 0) {
    return schemas;
  }

  // Find tsconfig.json for proper type resolution
  const configPath = findTsConfig(dirname(path));

  const config: Config = {
    path,
    ...(configPath && { tsconfig: configPath }),
    skipTypeCheck: true,
    encodeRefs: false,
  };

  const generator = createGenerator(config);

  for (const { name } of types) {
    try {
      const schema = generator.createSchema(name);
      const definitions = (schema.definitions || {}) as Record<string, unknown>;

      // Get the schema for this specific type (may be in definitions or at root)
      let result: unknown = definitions[name] || schema;

      // Inline all $ref references to make the schema self-contained
      result = inlineRefs(result, definitions);

      // Remove the $schema and definitions properties from root if present
      if (typeof result === "object" && result !== null) {
        const cleaned = { ...result as Record<string, unknown> };
        delete cleaned["$schema"];
        delete cleaned["definitions"];
        schemas.set(name, cleaned as object);
      } else {
        schemas.set(name, result as object);
      }
    } catch (error) {
      // Log warning but continue with other types
      console.warn(
        `[@thinkwell/bun-plugin] Failed to generate schema for ${name}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return schemas;
}

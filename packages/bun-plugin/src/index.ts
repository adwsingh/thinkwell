/**
 * Bun plugin for automatic JSON Schema generation from TypeScript types
 * marked with @JSONSchema.
 *
 * This plugin intercepts TypeScript file loads and injects namespace
 * declarations containing SchemaProvider implementations for each
 * marked type.
 *
 * @example
 * ```typescript
 * // In bunfig.toml:
 * // preload = ["@thinkwell/bun-plugin"]
 *
 * // Or via CLI:
 * // bun --preload @thinkwell/bun-plugin script.ts
 *
 * // In your script:
 * /** @JSONSchema *\/
 * interface Greeting {
 *   message: string;
 * }
 *
 * // Greeting.Schema is automatically available!
 * console.log(Greeting.Schema.toJsonSchema());
 * ```
 *
 * @packageDocumentation
 */

import { plugin, type BunPlugin } from "bun";
import { findMarkedTypes, type TypeInfo } from "./transform.js";
import { generateSchemas } from "./schema-generator.js";
import { generateInjections } from "./codegen.js";
import { SchemaCache } from "./schema-cache.js";

const JSONSCHEMA_TAG = "@JSONSchema";

const schemaCache = new SchemaCache();

/**
 * The thinkwell Bun plugin for automatic schema generation.
 */
export const thinkwellPlugin: BunPlugin = {
  name: "thinkwell-schema",

  setup(build) {
    build.onLoad({ filter: /\.tsx?$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();

      // Fast path: skip files without @JSONSchema
      if (!source.includes(JSONSCHEMA_TAG)) {
        return undefined; // Let Bun handle normally
      }

      // Check cache
      const stat = Bun.file(path);
      const mtime = (await stat.stat()).mtime.getTime();
      const cached = schemaCache.get(path, mtime);

      let markedTypes: TypeInfo[];
      let schemas: Map<string, object>;

      if (cached) {
        markedTypes = cached.types;
        schemas = cached.schemas;
      } else {
        // Parse with TypeScript to find marked types
        markedTypes = findMarkedTypes(path, source);

        if (markedTypes.length === 0) {
          return undefined;
        }

        // Generate schemas using ts-json-schema-generator
        schemas = generateSchemas(path, markedTypes);

        // Cache the results
        schemaCache.set(path, mtime, markedTypes, schemas);
      }

      if (markedTypes.length === 0) {
        return undefined;
      }

      // Inject namespace declarations with schemas
      const injectedCode = generateInjections(markedTypes, schemas);
      const modifiedSource = source + "\n" + injectedCode;

      return {
        contents: modifiedSource,
        loader: path.endsWith(".tsx") ? "tsx" : "ts",
      };
    });
  },
};

// Register the plugin when this module is preloaded
plugin(thinkwellPlugin);

export default thinkwellPlugin;
export type { TypeInfo } from "./transform.js";

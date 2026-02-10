/**
 * Minimal type stub for test fixtures.
 * Provides just enough for @JSONSchema transformation to type-check.
 */
export { JsonSchema } from "@thinkwell/protocol";

export interface SchemaProvider<T> {
  toJsonSchema(): import("@thinkwell/protocol").JsonSchema;
}

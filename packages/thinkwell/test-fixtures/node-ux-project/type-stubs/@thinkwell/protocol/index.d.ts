/**
 * Minimal type stub for test fixtures.
 * Provides just enough for @JSONSchema transformation to type-check.
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  [key: string]: unknown;
}

#!/usr/bin/env thinkwell
/**
 * Type-only imports test.
 * Tests that type-only imports are properly stripped.
 */

// Type-only import from node:fs
import type { Stats } from "node:fs";

// Type alias using the imported type
type FileInfo = {
  stats: Stats | null;
  path: string;
};

// Interface using imported types
interface FileResult {
  success: boolean;
  info?: FileInfo;
  error?: string;
}

// Function that uses the types
function createFileResult(path: string, stats: Stats | null): FileResult {
  if (stats) {
    return {
      success: true,
      info: { stats, path },
    };
  }
  return {
    success: false,
    error: "File not found",
  };
}

// Inline type-only import syntax
import { statSync, type Dirent } from "node:fs";

// Type using inline type import
type DirectoryEntry = {
  entry: Dirent;
  fullPath: string;
};

console.log("=== Type-Only Imports Test ===");

// Test with actual runtime code
// Use process.argv[1] to get the script path (works in both CJS and ESM)
const scriptPath = process.argv[1];
const stats = statSync(scriptPath);
const result = createFileResult(scriptPath, stats);
console.log(`File result success: ${result.success}`);
console.log(`File size: ${result.info?.stats?.size ?? "unknown"}`);

console.log("=== Type-Only Imports Test Passed ===");

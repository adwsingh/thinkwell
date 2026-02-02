#!/usr/bin/env thinkwell
/**
 * Documentation of unsupported TypeScript features.
 *
 * These features are NOT supported by --experimental-strip-types
 * and require --experimental-transform-types instead:
 *
 * - Enums (both regular and const enums)
 * - Namespaces
 * - Parameter properties (public/private in constructor params)
 * - Legacy decorators (experimentalDecorators)
 * - JSX (in .ts files, works in .tsx with additional flags)
 *
 * This file demonstrates what DOES work with strip-types.
 */

// ============================================================================
// SUPPORTED: Type annotations are stripped
// ============================================================================

const name: string = "TypeScript";
const count: number = 42;
const active: boolean = true;

// ============================================================================
// SUPPORTED: Interfaces are stripped entirely
// ============================================================================

interface User {
  name: string;
  age: number;
}

const user: User = { name: "Alice", age: 30 };

// ============================================================================
// SUPPORTED: Type aliases are stripped entirely
// ============================================================================

type Status = "active" | "inactive" | "pending";
const status: Status = "active";

// ============================================================================
// SUPPORTED: Generic functions and classes (without parameter properties)
// ============================================================================

function identity<T>(value: T): T {
  return value;
}

class Container<T> {
  private data: T;

  constructor(data: T) {
    this.data = data;
  }

  get(): T {
    return this.data;
  }
}

// ============================================================================
// SUPPORTED: Type-only imports are stripped
// ============================================================================

import type { Stats } from "node:fs";
import { existsSync, type Dirent } from "node:fs";

// ============================================================================
// SUPPORTED: Type assertions with 'as' keyword
// ============================================================================

const value = "hello" as string;
const maybeNum: unknown = 42;
const num = maybeNum as number;

// ============================================================================
// NOT SUPPORTED (would error): These features need transformation
// ============================================================================

// // Enum (both regular and const)
// enum Color { Red, Green, Blue }
// const enum Direction { Up = "UP", Down = "DOWN" }

// // Namespace
// namespace Utils {
//   export function log(msg: string): void {
//     console.log(msg);
//   }
// }

// // Parameter property
// class Point {
//   constructor(public x: number, public y: number) {}
// }

// // Legacy decorators
// @sealed
// class Greeter {
//   greeting: string;
// }

console.log("=== Unsupported Features Documentation ===");
console.log("");
console.log("This script demonstrates TypeScript features that WORK with");
console.log("--experimental-strip-types (Node 24+):");
console.log("");
console.log("  ✓ Type annotations (const x: string = ...)");
console.log("  ✓ Interfaces and type aliases");
console.log("  ✓ Generic functions and classes");
console.log("  ✓ Type-only imports (import type {...})");
console.log("  ✓ Inline type imports (import { x, type Y })");
console.log("  ✓ Type assertions (value as Type)");
console.log("");
console.log("Features that do NOT work (require --experimental-transform-types):");
console.log("");
console.log("  ✗ Enums (regular and const)");
console.log("  ✗ Namespaces");
console.log("  ✗ Parameter properties (public x in constructor)");
console.log("  ✗ Legacy decorators");
console.log("  ✗ JSX in .ts files");
console.log("");
console.log("=== Documentation Complete ===");

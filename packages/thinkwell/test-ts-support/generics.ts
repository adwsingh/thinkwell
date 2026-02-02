#!/usr/bin/env thinkwell
/**
 * Generics test - tests generic types and functions.
 * Tests that --experimental-strip-types handles generics correctly.
 */

// Generic function
function identity<T>(value: T): T {
  return value;
}

// Generic interface
interface Container<T> {
  value: T;
  getValue(): T;
}

// Generic class
// Note: Parameter properties (public/private in constructor) are NOT supported
// in strip-only mode. Must explicitly declare and assign the property.
class Box<T> implements Container<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }

  map<U>(fn: (val: T) => U): Box<U> {
    return new Box(fn(this.value));
  }
}

// Multiple type parameters
function pair<T, U>(first: T, second: U): [T, U] {
  return [first, second];
}

// Generic constraints
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(item: T): number {
  console.log(`  Length: ${item.length}`);
  return item.length;
}

console.log("=== Generics Test ===");

// Test identity function
const strResult = identity<string>("hello");
const numResult = identity(42); // Type inference
console.log(`Identity string: ${strResult}`);
console.log(`Identity number: ${numResult}`);

// Test generic class
const stringBox = new Box("world");
const mappedBox = stringBox.map((s) => s.toUpperCase());
console.log(`Box value: ${stringBox.getValue()}`);
console.log(`Mapped box value: ${mappedBox.getValue()}`);

// Test multiple type parameters
const [first, second] = pair("key", 123);
console.log(`Pair: [${first}, ${second}]`);

// Test generic constraints
logLength("test string");
logLength([1, 2, 3, 4]);

console.log("=== Generics Test Passed ===");

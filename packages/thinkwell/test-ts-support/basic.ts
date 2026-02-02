#!/usr/bin/env thinkwell
/**
 * Basic TypeScript test - simple types and interfaces.
 * Tests that --experimental-strip-types works in the pkg binary.
 */

// Basic type annotations
const greeting: string = "Hello, TypeScript!";
const count: number = 42;
const active: boolean = true;

// Interface
interface Person {
  name: string;
  age: number;
}

// Function with type annotations
function greet(person: Person): string {
  return `Hello, ${person.name}! You are ${age} years old.`;
}

// Object literal with interface type
const user: Person = {
  name: "Alice",
  age: 30,
};

console.log("=== Basic TypeScript Test ===");
console.log(`Greeting: ${greeting}`);
console.log(`Count: ${count}`);
console.log(`Active: ${active}`);
console.log(`User: ${JSON.stringify(user)}`);
console.log("=== Test Passed ===");

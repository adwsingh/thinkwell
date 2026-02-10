import { Greeting, Person } from "./types.js";

// Verify that @JSONSchema namespace merging makes .Schema available
const greetingSchema = Greeting.Schema.toJsonSchema();
const personSchema = Person.Schema.toJsonSchema();

console.log("Greeting schema type:", greetingSchema.type);
console.log("Person schema type:", personSchema.type);

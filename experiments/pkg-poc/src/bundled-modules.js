/**
 * Simulated bundled modules (like thinkwell, @thinkwell/acp, etc.)
 * These would be the modules we want to bundle INTO the pkg executable.
 */

// Simulated Agent class (like thinkwell's Agent)
class Agent {
  constructor(name) {
    this.name = name;
    console.log(`[Agent] Created agent: ${name}`);
  }

  async run(input) {
    console.log(`[Agent ${this.name}] Processing: ${input}`);
    return { result: `Processed by ${this.name}: ${input}` };
  }
}

// Simulated Tool class
class Tool {
  constructor(name, handler) {
    this.name = name;
    this.handler = handler;
  }

  async execute(params) {
    return this.handler(params);
  }
}

// Simulated SchemaProvider (like @thinkwell/acp's SchemaProvider)
class SchemaProvider {
  constructor(schema) {
    this.schema = schema;
  }

  toJsonSchema() {
    return this.schema;
  }
}

module.exports = {
  Agent,
  Tool,
  SchemaProvider,
};

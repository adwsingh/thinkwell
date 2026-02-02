/**
 * This script simulates how a real thinkwell user script would look.
 * It imports from both:
 * - "thinkwell" (bundled in the CLI's virtual filesystem)
 * - User's own packages (from real filesystem node_modules)
 */

// Import from bundled "thinkwell" package (via global registry)
// In real thinkwell with proper import rewriting, this would be:
// import { Agent, Tool } from "thinkwell";
const { Agent, Tool } = global.__bundled__['thinkwell'];

// Import from bundled "@thinkwell/acp" package
// import { SchemaProvider } from "@thinkwell/acp";
const { SchemaProvider } = global.__bundled__['@thinkwell/acp'];

// Import from user's own node_modules (real filesystem)
const Sentiment = require('sentiment');

// === Application Code ===

console.log('=== Thinkwell-Style User Script ===');
console.log('');

// Create an agent (from bundled thinkwell)
const sentimentAgent = new Agent('sentiment-analyzer');

// Create a schema (from bundled @thinkwell/acp)
const inputSchema = new SchemaProvider({
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Text to analyze' }
  },
  required: ['text']
});

console.log('Input schema:', JSON.stringify(inputSchema.toJsonSchema(), null, 2));
console.log('');

// Create a tool that uses external sentiment package
const sentiment = new Sentiment();
const analyzeTool = new Tool('analyze', async (params) => {
  const result = sentiment.analyze(params.text);
  return {
    score: result.score,
    comparative: result.comparative,
    positive: result.positive,
    negative: result.negative,
  };
});

// Simulate running the agent
async function main() {
  console.log('Running sentiment analysis...');
  console.log('');

  const testInputs = [
    { text: 'I absolutely love this product!' },
    { text: 'This is the worst experience ever.' },
    { text: 'The service was okay, nothing special.' },
  ];

  for (const input of testInputs) {
    const agentResult = await sentimentAgent.run(input.text);
    const toolResult = await analyzeTool.execute(input);

    console.log(`Input: "${input.text}"`);
    console.log(`  Sentiment score: ${toolResult.score}`);
    console.log(`  Positive words: ${toolResult.positive.join(', ') || 'none'}`);
    console.log(`  Negative words: ${toolResult.negative.join(', ') || 'none'}`);
    console.log('');
  }

  console.log('=== Script Completed Successfully ===');
}

module.exports = { main };

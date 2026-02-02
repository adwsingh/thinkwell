/**
 * TypeScript version of the thinkwell-style script.
 * Tests native TypeScript loading with complex types.
 */

// TypeScript interfaces
interface SentimentResult {
  score: number;
  comparative: number;
  positive: string[];
  negative: string[];
}

interface AgentLike {
  name: string;
  run(input: string): Promise<{ result: string }>;
}

interface ToolLike {
  name: string;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

// Import from bundled "thinkwell" package (via global registry)
const { Agent, Tool } = (global as any).__bundled__['thinkwell'];
const { SchemaProvider } = (global as any).__bundled__['@thinkwell/acp'];

// Import from user's node_modules (real filesystem)
const Sentiment = require('sentiment');

console.log('=== TypeScript Thinkwell-Style Script ===');
console.log('');

// Create a typed agent
const sentimentAgent: AgentLike = new Agent('sentiment-analyzer');

// Create a schema with proper typing
const inputSchema = new SchemaProvider({
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Text to analyze' }
  },
  required: ['text']
});

console.log('Input schema:', JSON.stringify(inputSchema.toJsonSchema(), null, 2));
console.log('');

// External module from user's node_modules
const sentiment = new Sentiment();

// Type-safe sentiment analysis
function analyzeSentiment(text: string): SentimentResult {
  const result = sentiment.analyze(text);
  return {
    score: result.score,
    comparative: result.comparative,
    positive: result.positive,
    negative: result.negative,
  };
}

// Create a typed tool
const analyzeTool: ToolLike = new Tool('analyze', async (params: { text: string }) => {
  return analyzeSentiment(params.text);
});

async function main(): Promise<void> {
  console.log('Running TypeScript sentiment analysis...');
  console.log('');

  const testInputs: Array<{ text: string }> = [
    { text: 'TypeScript is absolutely fantastic!' },
    { text: 'Bugs in production are terrible and stressful.' },
    { text: 'The documentation could be better.' },
  ];

  for (const input of testInputs) {
    await sentimentAgent.run(input.text);
    const result = await analyzeTool.execute(input) as SentimentResult;

    console.log(`Input: "${input.text}"`);
    console.log(`  Score: ${result.score}`);
    console.log(`  Positive: ${result.positive.join(', ') || 'none'}`);
    console.log(`  Negative: ${result.negative.join(', ') || 'none'}`);
    console.log('');
  }

  console.log('=== TypeScript Script Completed ===');
}

module.exports = { main };

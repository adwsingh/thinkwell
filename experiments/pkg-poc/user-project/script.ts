/**
 * TypeScript version of the user script.
 * This tests if pkg can handle TypeScript files.
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

// Import from bundled packages (via global registry)
const { Agent, Tool } = (global as any).__bundled__['thinkwell'];
const { SchemaProvider } = (global as any).__bundled__['@thinkwell/acp'];

// Import from user's node_modules
const Sentiment = require('sentiment');

console.log('=== TypeScript User Script ===');
console.log('');

// Create typed agent
const agent: AgentLike = new Agent('ts-agent');

// Use the schema provider
const schema = new SchemaProvider({
  type: 'object',
  properties: {
    text: { type: 'string' }
  }
});

// Analyze sentiment with proper typing
const sentiment = new Sentiment();
const analyze = (text: string): SentimentResult => {
  const result = sentiment.analyze(text);
  return {
    score: result.score,
    comparative: result.comparative,
    positive: result.positive,
    negative: result.negative,
  };
};

async function main(): Promise<void> {
  const result = analyze('TypeScript is awesome!');
  console.log('TypeScript sentiment analysis:');
  console.log('  Score:', result.score);
  console.log('  Comparative:', result.comparative.toFixed(3));

  await agent.run('Testing TypeScript support');

  console.log('');
  console.log('=== TypeScript Script Completed ===');
}

module.exports = { main };

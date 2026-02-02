/**
 * ESM user script simulating real thinkwell usage
 * Tests: ESM-only deps, bundled modules, named exports
 */

import chalk from 'chalk';

// Simulated thinkwell import pattern (would be transformed)
const { Agent } = global.__bundled__?.thinkwell ?? {};

class SentimentAgent {
  constructor() {
    if (!Agent) {
      throw new Error('Bundled modules not available');
    }
    this.agent = new Agent('sentiment-analyzer');
  }

  analyze(text) {
    // Simple sentiment analysis (mock)
    const positive = ['good', 'great', 'excellent', 'amazing', 'fantastic'];
    const negative = ['bad', 'terrible', 'awful', 'horrible', 'poor'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    for (const word of words) {
      if (positive.includes(word)) score++;
      if (negative.includes(word)) score--;
    }
    return { text, score, sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral' };
  }
}

export default async function main() {
  console.log(chalk.cyan('=== Thinkwell-Style ESM Script ==='));

  const analyzer = new SentimentAgent();
  console.log(chalk.blue(`Agent: ${analyzer.agent.name}`));

  const inputs = [
    'This is a great and excellent product!',
    'The service was terrible and awful.',
    'The weather is okay today.',
  ];

  for (const input of inputs) {
    const result = analyzer.analyze(input);
    const color = result.sentiment === 'positive' ? chalk.green
      : result.sentiment === 'negative' ? chalk.red
      : chalk.yellow;
    console.log(color(`  "${input}" → ${result.sentiment} (${result.score})`));
  }

  console.log(chalk.cyan('=== Script Completed ==='));
}

/**
 * ESM user script WITHOUT top-level await
 * This should work with require(esm) in Node 22.12+
 */

// Import from user's node_modules (ESM-only package)
import chalk from 'chalk';

// Access bundled modules via global (fallback pattern)
const { Agent } = global.__bundled__?.thinkwell ?? {};

console.log('=== ESM User Script (no TLA) ===');
console.log(chalk.green('✓ chalk imported successfully (ESM-only package)'));

if (Agent) {
  const agent = new Agent('test-agent');
  console.log(chalk.blue(`✓ Bundled Agent created: ${agent.name}`));
} else {
  console.log(chalk.yellow('⚠ Bundled modules not available (running standalone)'));
}

export function greet(name) {
  return chalk.cyan(`Hello, ${name}!`);
}

export default function main() {
  console.log('');
  console.log(greet('World'));
  console.log(chalk.green('=== ESM Script Completed ==='));
}

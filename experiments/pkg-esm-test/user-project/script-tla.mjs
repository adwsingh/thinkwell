/**
 * ESM user script WITH top-level await
 * This will NOT work with require(esm) - needs dynamic import()
 */

import chalk from 'chalk';

// Top-level await - simulating async initialization
const startTime = await Promise.resolve(Date.now());

console.log('=== ESM User Script (WITH TLA) ===');
console.log(chalk.green('✓ Top-level await executed'));
console.log(chalk.blue(`Start time: ${startTime}`));

export default function main() {
  const elapsed = Date.now() - startTime;
  console.log(chalk.cyan(`Elapsed: ${elapsed}ms`));
  console.log(chalk.green('=== TLA Script Completed ==='));
}

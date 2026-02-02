/**
 * User script that demonstrates importing:
 * 1. Bundled modules (lodash) - provided by the CLI's virtual filesystem
 * 2. External modules (sentiment) - from user's own node_modules
 */

// Import bundled module via the global registry
// In real thinkwell, this would be: import { Agent } from "thinkwell";
const _ = global.__bundled__.lodash;

// Import external module from user's node_modules
// This is the key test - can we import from real filesystem?
const Sentiment = require('sentiment');

console.log('=== User Script Running ===');
console.log('');

// Test bundled module (lodash)
console.log('Testing bundled lodash:');
const numbers = [1, 2, 3, 4, 5];
console.log('  _.sum([1,2,3,4,5]):', _.sum(numbers));
console.log('  _.shuffle([1,2,3,4,5]):', _.shuffle(numbers));
console.log('');

// Test external module (sentiment)
console.log('Testing external sentiment package:');
const sentiment = new Sentiment();
const texts = [
  'I love this product! It is amazing!',
  'This is terrible and I hate it.',
  'The weather is nice today.',
];

for (const text of texts) {
  const result = sentiment.analyze(text);
  console.log(`  "${text.substring(0, 30)}..."`);
  console.log(`    Score: ${result.score}, Comparative: ${result.comparative.toFixed(3)}`);
}

console.log('');
console.log('=== User Script Completed ===');

module.exports = function main() {
  console.log('main() called');
};

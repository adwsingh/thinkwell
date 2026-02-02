/**
 * Test transitive dependencies - the sentiment package imports other packages
 * internally. Let's verify those work too.
 */

const _ = global.__bundled__.lodash;
const Sentiment = require('sentiment');

console.log('=== Testing Transitive Dependencies ===');
console.log('');

// Sentiment internally uses AFINN word list
const sentiment = new Sentiment();

// Test that the internal dependencies work
const result = sentiment.analyze('I absolutely love this wonderful amazing fantastic product');
console.log('Complex sentiment analysis:');
console.log('  Text: "I absolutely love this wonderful amazing fantastic product"');
console.log('  Score:', result.score);
console.log('  Words analyzed:', result.words);
console.log('  Positive words:', result.positive);
console.log('  Negative words:', result.negative);

// Test lodash chaining with sentiment results
const avgScores = _.chain([
  'I love this!',
  'This is terrible.',
  'Okay product.',
  'Amazing quality!',
  'Worst purchase ever.'
])
  .map(text => sentiment.analyze(text))
  .map(r => r.score)
  .value();

console.log('');
console.log('Batch analysis scores:', avgScores);
console.log('Average score:', _.mean(avgScores).toFixed(2));

console.log('');
console.log('=== Transitive Dependencies Work! ===');

module.exports = {};

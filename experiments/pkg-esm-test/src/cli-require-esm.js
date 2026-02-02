#!/usr/bin/env node
/**
 * Test 2: CommonJS CLI that uses require(esm) - the new stable feature in Node 22.12+
 *
 * Since Node.js v20.19.0+ and v22.12.0+, require(esm) is stable and unflagged.
 * This tests whether pkg can leverage this for loading ESM user scripts.
 *
 * Key insight: require(esm) works for ESM modules WITHOUT top-level await.
 * Modules with top-level await still need dynamic import().
 */

const path = require('path');
const fs = require('fs');

// Bundled modules
const _ = require('lodash');

// Expose bundled modules globally
global.__bundled__ = {
  lodash: _,
  'thinkwell': { Agent: class Agent { constructor(name) { this.name = name; } } },
};

console.log('=== pkg ESM Test: require(esm) approach ===');
console.log('Running in pkg:', !!process.pkg);
console.log('Node version:', process.version);
console.log('');

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('Usage: esm-test-require-esm <script.mjs>');
  process.exit(1);
}

const resolvedPath = path.isAbsolute(scriptPath)
  ? scriptPath
  : path.resolve(process.cwd(), scriptPath);

console.log('Loading user script:', resolvedPath);
console.log('');

if (!fs.existsSync(resolvedPath)) {
  console.error('Error: Script not found:', resolvedPath);
  process.exit(1);
}

async function main() {
  console.log('Attempting require() on ESM file...');

  try {
    // With Node 22.12+, require() can load ESM modules synchronously
    // as long as they don't have top-level await
    const module = require(resolvedPath);

    console.log('');
    console.log('SUCCESS: ESM module loaded via require()!');
    console.log('Exports:', Object.keys(module));
    console.log('');
    console.log('Module namespace object:', module);

    if (module.default && typeof module.default === 'function') {
      console.log('');
      console.log('Running default export...');
      await module.default();
    }
  } catch (error) {
    console.error('');
    console.error('FAILED:', error.code || error.name);
    console.error(error.message);

    if (error.code === 'ERR_REQUIRE_ESM') {
      console.error('');
      console.error('This Node.js version does not support require(esm).');
      console.error('Requires Node.js v20.19.0+ or v22.12.0+');
    } else if (error.code === 'ERR_REQUIRE_ASYNC_MODULE') {
      console.error('');
      console.error('This ESM module uses top-level await.');
      console.error('Use dynamic import() instead for async modules.');
    }
    process.exit(1);
  }
}

main();

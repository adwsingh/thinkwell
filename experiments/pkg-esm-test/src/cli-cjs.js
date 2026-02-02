#!/usr/bin/env node
/**
 * Test 1: CommonJS CLI that loads ESM user scripts via dynamic import()
 *
 * This tests whether pkg can handle dynamic import() for loading ESM modules
 * from the real filesystem.
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Bundled modules
const _ = require('lodash');

// Expose bundled modules globally
global.__bundled__ = {
  lodash: _,
  'thinkwell': { Agent: class Agent { constructor(name) { this.name = name; } } },
};

console.log('=== pkg ESM Test: CJS CLI with dynamic import() ===');
console.log('Running in pkg:', !!process.pkg);
console.log('Node version:', process.version);
console.log('');

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('Usage: esm-test-cjs <script.mjs>');
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
  try {
    // Convert to file:// URL for ESM import
    const { pathToFileURL } = require('url');
    const fileUrl = pathToFileURL(resolvedPath).href;

    console.log('Attempting dynamic import()...');
    console.log('URL:', fileUrl);

    const module = await import(fileUrl);

    console.log('');
    console.log('SUCCESS: ESM module loaded!');
    console.log('Exports:', Object.keys(module));

    if (module.default && typeof module.default === 'function') {
      console.log('');
      console.log('Running default export...');
      await module.default();
    }
  } catch (error) {
    console.error('');
    console.error('FAILED:', error.code || error.name);
    console.error(error.message);
    if (error.code === 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING') {
      console.error('');
      console.error('This error is expected in pkg - dynamic import() is not supported');
      console.error('in the virtual filesystem context.');
    }
    process.exit(1);
  }
}

main();

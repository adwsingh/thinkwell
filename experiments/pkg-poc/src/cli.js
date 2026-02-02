#!/usr/bin/env node
/**
 * Proof-of-concept CLI for testing pkg's ability to:
 * 1. Bundle internal modules (like lodash) in the virtual filesystem
 * 2. Dynamically load user scripts from the real filesystem
 * 3. Have those user scripts import BOTH:
 *    - Bundled modules (from the virtual filesystem)
 *    - External modules (from the user's node_modules)
 * 4. Support TypeScript via esbuild transpilation
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const vm = require('vm');

// Bundled modules - these are included in the pkg executable
const _ = require('lodash');
const bundledModules = require('./bundled-modules');

// Expose bundled modules globally so external scripts can access them
// This is the key workaround for pkg - simulating thinkwell's virtual imports
global.__bundled__ = {
  lodash: _,
  // Simulate thinkwell packages
  'thinkwell': bundledModules,
  '@thinkwell/acp': bundledModules,
};

// Also expose require so external scripts can use bundled modules
global.__bundledRequire__ = require;

console.log('=== pkg-poc CLI ===');
console.log('Running in pkg:', !!process.pkg);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('process.execPath:', process.execPath);
console.log('');

// Check if lodash is properly bundled
console.log('Bundled lodash version:', _.VERSION);
console.log('');

// Get the user script path from command line
const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('Usage: pkg-poc <script.js|script.ts>');
  console.error('');
  console.error('The script can import:');
  console.error('  - Bundled modules via global.__bundled__["thinkwell"]');
  console.error('  - External modules from its own node_modules');
  process.exit(1);
}

// Resolve the script path relative to cwd (real filesystem)
const resolvedPath = path.isAbsolute(scriptPath)
  ? scriptPath
  : path.resolve(process.cwd(), scriptPath);

console.log('Loading user script:', resolvedPath);
console.log('');

// Check if the file exists
if (!fs.existsSync(resolvedPath)) {
  console.error('Error: Script not found:', resolvedPath);
  process.exit(1);
}

/**
 * Transpile TypeScript to JavaScript using sucrase.
 * Sucrase is a pure-JS transpiler that works in pkg.
 * Returns the transpiled code or original if not a TS file.
 */
function transpileIfNeeded(filePath, code) {
  const ext = path.extname(filePath);
  if (ext !== '.ts' && ext !== '.tsx') {
    return code;
  }

  console.log('Transpiling TypeScript...');

  // Use sucrase for fast, pure-JS transpilation
  const { transform } = require('sucrase');
  const result = transform(code, {
    transforms: ['typescript'],
    disableESTransforms: true,
  });

  return result.code;
}

/**
 * Create a custom require function that can resolve both bundled and external modules.
 */
function createCustomRequire(scriptDir) {
  return function customRequire(moduleName) {
    // First check if it's a bundled module
    if (global.__bundled__[moduleName]) {
      console.log(`  [resolve] ${moduleName} -> bundled`);
      return global.__bundled__[moduleName];
    }

    // Try to resolve from the script's directory
    try {
      const resolved = require.resolve(moduleName, {
        paths: [scriptDir, path.join(scriptDir, 'node_modules')]
      });
      console.log(`  [resolve] ${moduleName} -> ${resolved}`);
      return require(resolved);
    } catch (e) {
      // Fall back to global require (for node built-ins, etc.)
      console.log(`  [resolve] ${moduleName} -> global require`);
      return require(moduleName);
    }
  };
}

/**
 * Load a script using vm.runInThisContext with custom require.
 * This gives us full control over module resolution.
 */
async function loadWithVm(scriptPath) {
  console.log('Loading with vm.runInThisContext()...');

  try {
    let code = fs.readFileSync(scriptPath, 'utf-8');
    const scriptDir = path.dirname(scriptPath);

    // Transpile TypeScript if needed
    code = transpileIfNeeded(scriptPath, code);

    // Create custom require for this script
    const customRequire = createCustomRequire(scriptDir);

    // Create module exports object
    const moduleExports = {};
    const moduleObj = { exports: moduleExports };

    // Wrap the code in a function to provide CommonJS globals
    const wrappedCode = `
      (function(exports, require, module, __filename, __dirname) {
        ${code}
      })
    `;

    const compiledFn = vm.runInThisContext(wrappedCode, {
      filename: scriptPath,
    });

    compiledFn(
      moduleExports,
      customRequire,
      moduleObj,
      scriptPath,
      scriptDir
    );

    console.log('Success! Module loaded with vm');
    return moduleObj.exports;
  } catch (error) {
    console.log('vm failed:', error.message);
    console.log(error.stack);
    return null;
  }
}

/**
 * Load a JavaScript file directly with require.
 * Only works for .js files without custom resolution needs.
 */
async function loadWithRequire(scriptPath) {
  console.log('Attempting to load with require()...');
  try {
    // Clear any cached version
    delete require.cache[require.resolve(scriptPath)];
    const result = require(scriptPath);
    console.log('Success! Module loaded with require()');
    return result;
  } catch (error) {
    console.log('require() failed:', error.message);
    return null;
  }
}

// Main execution
async function main() {
  const ext = path.extname(resolvedPath);
  let result;

  // For TypeScript files or when we need custom resolution, use vm approach
  if (ext === '.ts' || ext === '.tsx') {
    result = await loadWithVm(resolvedPath);
  } else {
    // For JS files, try require first (simpler and handles more edge cases)
    result = await loadWithRequire(resolvedPath);

    if (!result) {
      // Fall back to vm for custom resolution
      result = await loadWithVm(resolvedPath);
    }
  }

  if (!result) {
    console.error('All loading strategies failed!');
    process.exit(1);
  }

  console.log('');
  console.log('=== User script executed successfully ===');

  // If the module exports a main function, call it
  if (typeof result === 'function') {
    await result();
  } else if (result.default && typeof result.default === 'function') {
    await result.default();
  } else if (result.main && typeof result.main === 'function') {
    await result.main();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

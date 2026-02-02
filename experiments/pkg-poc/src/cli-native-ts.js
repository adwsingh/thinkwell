#!/usr/bin/env node
/**
 * Proof-of-concept CLI using Node.js native TypeScript support.
 * This version relies on --experimental-strip-types being baked into the binary.
 *
 * Key difference from cli.js: No sucrase transpilation - Node handles .ts files natively.
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

// Bundled modules - these are included in the pkg executable
const _ = require('lodash');
const bundledModules = require('./bundled-modules');

// Expose bundled modules globally so external scripts can access them
global.__bundled__ = {
  lodash: _,
  'thinkwell': bundledModules,
  '@thinkwell/acp': bundledModules,
};

global.__bundledRequire__ = require;

console.log('=== pkg-poc CLI (Native TypeScript) ===');
console.log('Running in pkg:', !!process.pkg);
console.log('Node version:', process.version);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('');
console.log('Bundled lodash version:', _.VERSION);
console.log('');

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('Usage: pkg-poc <script.js|script.ts>');
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
      console.log(`  [resolve] ${moduleName} -> global require`);
      return require(moduleName);
    }
  };
}

/**
 * Attempt to load using Node's native require (works for .ts with --experimental-strip-types)
 */
async function loadWithNativeRequire(scriptPath) {
  console.log('Attempting native require() for TypeScript...');
  const scriptDir = path.dirname(scriptPath);

  try {
    // Clear cache
    delete require.cache[require.resolve(scriptPath)];

    // Native require should handle .ts files with --experimental-strip-types
    const result = require(scriptPath);
    console.log('Success! Module loaded with native require()');
    return result;
  } catch (error) {
    console.log('Native require() failed:', error.message);
    return null;
  }
}

/**
 * Fallback: Read and run with vm (for custom require resolution)
 */
async function loadWithVm(scriptPath) {
  console.log('Attempting vm.runInThisContext()...');
  const scriptDir = path.dirname(scriptPath);

  try {
    // For TypeScript, we rely on Node's strip-types to work when we require
    // But if we need custom require, we need to read and compile ourselves
    let code = fs.readFileSync(scriptPath, 'utf-8');

    // Node's type stripping doesn't work with vm.runInThisContext directly
    // So we need to either use the native require or fall back to sucrase
    // Let's try requiring from a temp location to get Node's native TS support

    const customRequire = createCustomRequire(scriptDir);
    const moduleExports = {};
    const moduleObj = { exports: moduleExports };

    // Try to use Node's Module._compile which should handle TS natively
    const Module = require('module');
    const m = new Module(scriptPath, module);
    m.filename = scriptPath;
    m.paths = Module._nodeModulePaths(scriptDir);

    // Patch m.require to use our custom resolution
    const originalRequire = m.require.bind(m);
    m.require = function(id) {
      if (global.__bundled__[id]) {
        console.log(`  [resolve] ${id} -> bundled`);
        return global.__bundled__[id];
      }
      return originalRequire(id);
    };

    // _compile should use Node's built-in TypeScript handling
    m._compile(code, scriptPath);

    console.log('Success! Module loaded with Module._compile');
    return m.exports;
  } catch (error) {
    console.log('vm/Module._compile failed:', error.message);
    console.log(error.stack);
    return null;
  }
}

async function main() {
  let result;

  // Try native require first - this should work if --experimental-strip-types is baked in
  result = await loadWithNativeRequire(resolvedPath);

  if (!result) {
    // Fall back to vm approach with Module._compile
    result = await loadWithVm(resolvedPath);
  }

  if (!result) {
    console.error('All loading strategies failed!');
    process.exit(1);
  }

  console.log('');
  console.log('=== User script executed successfully ===');

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

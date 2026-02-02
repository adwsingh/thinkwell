# pkg ESM Support Test

This experiment tests different approaches for ESM support in pkg.

## Background

The main thinkwell RFD identifies ESM support as an open question. This experiment
tests the following approaches:

### Approach 1: Dynamic import() from CJS (`cli-cjs.js`)

Uses `await import(fileUrl)` to load ESM modules. This is the traditional approach
but has known issues in pkg due to `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.

### Approach 2: require(esm) (`cli-require-esm.js`)

Uses the new stable `require(esm)` feature in Node.js 20.19.0+ and 22.12.0+.
This allows synchronous loading of ESM modules that don't use top-level await.

**Key insight**: 99.98% of npm packages don't use top-level await, so this
approach should work for most real-world scenarios.

## Test Scripts

- `user-project/script.mjs` - ESM without top-level await (should work with require)
- `user-project/script-tla.mjs` - ESM with top-level await (needs dynamic import)
- `user-project/script-thinkwell.mjs` - Thinkwell-style ESM with bundled module access

## Running Tests

```bash
# Install dependencies
npm install
cd user-project && npm install && cd ..

# Test in development (Node.js)
npm run test:dev:cjs
npm run test:dev:require-esm

# Build pkg binaries
npm run build:all

# Test with pkg binaries
npm run test:pkg:cjs
npm run test:pkg:require-esm
```

## Results (Tested 2026-02-02)

| Test | Development (Node 24) | pkg Binary (Node 24) |
|------|----------------------|---------------------|
| CJS + dynamic import (no TLA) | ✅ Works | ❌ ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING |
| CJS + dynamic import (TLA) | ✅ Works | ❌ ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING |
| require(esm) (no TLA) | ✅ Works | ✅ **WORKS!** |
| require(esm) (TLA) | ❌ ERR_REQUIRE_ASYNC_MODULE | ❌ ERR_REQUIRE_ASYNC_MODULE |

## Key Findings

### require(esm) Works in pkg Binaries!

The `require(esm)` feature (stable in Node 20.19.0+, 22.12.0+) **works correctly
in pkg-compiled binaries**. This is a major finding that simplifies ESM support.

**What this means for thinkwell:**

1. User scripts can be written as ESM (`.mjs` or `"type": "module"`)
2. They can import ESM-only packages (like `chalk` v5+) from their `node_modules`
3. They can access bundled modules via `global.__bundled__`
4. No pre-bundling or transpilation required

### Limitation: Top-Level Await

ESM modules using top-level `await` cannot be loaded via `require()`. They would
need dynamic `import()`, which doesn't work in pkg.

**Mitigation:** According to analysis of top 5000 npm packages, only 6 use
top-level await (~0.02%). For thinkwell's use case:

- User scripts should avoid top-level await
- Document this limitation clearly
- Provide error message suggesting workarounds if TLA is detected

### thinkwell:* Import Transformation

The ESM approach still requires transforming `thinkwell:*` imports:

```javascript
// User writes (ESM):
import { Agent } from "thinkwell:agent";

// Must be transformed to:
const { Agent } = global.__bundled__["thinkwell"];
```

This transformation can happen at load time using:
1. Read the ESM file
2. Transform `thinkwell:*` imports to `global.__bundled__` access
3. Write to a temp file or use `vm.SourceTextModule` (experimental)

## Recommendations for RFD Update

1. **Primary approach**: Use `require(esm)` for loading user ESM scripts
2. **Document TLA limitation**: User scripts should not use top-level await
3. **Transform thinkwell imports**: Continue using import transformation
4. **TypeScript**: Combine with `--experimental-strip-types` for native TS support
5. **Fallback**: For TLA scripts, suggest pre-bundling with esbuild

## References

- [require(esm) stability blog post](https://joyeecheung.github.io/blog/2025/12/30/require-esm-in-node-js-from-experiment-to-stability/)
- [Node.js SEA ESM support issue](https://github.com/nodejs/node/issues/53565)
- [pkg ESM issue #16](https://github.com/yao-pkg/pkg/issues/16)
- [pkg ESM PR #192](https://github.com/yao-pkg/pkg/pull/192)

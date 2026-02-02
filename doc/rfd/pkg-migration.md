# RFD: Migrate Binary Distribution from Bun to pkg

## Summary

This document proposes replacing Bun's `--compile` flag with [yao-pkg/pkg](https://github.com/yao-pkg/pkg) for building the thinkwell compiled binary. This migration solves a fundamental limitation in Bun's compiled binaries: the inability to resolve npm packages from a user's `node_modules` at runtime.

## Problem Statement

The current Bun-based binary distribution has a critical limitation that prevents user scripts from importing their own npm dependencies:

```typescript
// User's script: examples/src/sentiment.ts
import { Agent } from "thinkwell:agent";     // ✅ Works (transformed via globalThis.__thinkwell__)
import Sentiment from "sentiment";           // ❌ Fails
```

**Error:**
```
Cannot find package 'sentiment' from '/path/to/user/script.ts'
```

### Root Cause

When a Bun compiled binary executes `await import(userScript)`:

1. The binary's virtual filesystem uses `/$bunfs/` prefix
2. Bun's module resolution starts from `/$bunfs/root/...`
3. External packages in the user's `node_modules` cannot be found
4. Even `Bun.resolveSync()` with explicit paths has bugs in compiled binaries ([Issue #13405](https://github.com/oven-sh/bun/issues/13405))

### Why Bun Can't Fix This

This is a **known limitation** tracked across multiple Bun issues:

| Issue | Description | Status |
|-------|-------------|--------|
| [#5445](https://github.com/oven-sh/bun/issues/5445) | `--embed-dir` flag to embed arbitrary directories | Open |
| [#11732](https://github.com/oven-sh/bun/issues/11732) | Non-statically-analyzable dynamic imports | Open |
| [#8967](https://github.com/oven-sh/bun/issues/8967) | Include complete node_modules in binary | Open |
| [#26653](https://github.com/oven-sh/bun/issues/26653) | Plugin onLoad breaks transitive dependencies | Open |

**Key finding:** Bun plugins run at **bundle time**, not runtime. When the binary does `await import(userScript)`, there are no plugin hooks to intercept module resolution for the user script's dependencies.

## Research Findings

We built a proof-of-concept at `experiments/pkg-poc/` demonstrating that pkg successfully achieves what Bun cannot.

### pkg Architecture

pkg uses a `/snapshot/` virtual filesystem prefix and patches Node's `require` to serve bundled files. Critically, it maintains proper separation between:

- **Bundled modules** — Served from `/snapshot/...`
- **External modules** — Resolved from the real filesystem

```
┌─────────────────────────────────────────────────────────────────┐
│ Compiled Binary (/snapshot/)                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ thinkwell, @thinkwell/acp, @thinkwell/protocol              │ │
│ │ (bundled in virtual filesystem)                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                           ↓                                     │
│              require(userScript)                                │
│                           ↓                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ User Script Resolution                                       │ │
│ │                                                              │ │
│ │ require("thinkwell")  → global.__bundled__["thinkwell"]     │ │
│ │ require("sentiment")  → /user/project/node_modules/sentiment│ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Proof-of-Concept Results

| Test Case | Bun --compile | pkg |
|-----------|---------------|-----|
| Bundle thinkwell packages | ✅ | ✅ |
| Dynamic import from real FS | ✅ | ✅ |
| User script imports from node_modules | ❌ | ✅ |
| Transitive dependencies | ❌ | ✅ |
| TypeScript support | ✅ Built-in | ✅ Native (Node 24) |

### Native TypeScript Support

Node.js 24+ supports native TypeScript execution via `--experimental-strip-types`. This flag can be baked into the pkg binary:

```bash
pkg src/cli.js --targets node24-macos-arm64 --options experimental-strip-types -o thinkwell
```

The compiled binary can then directly `require('./user-script.ts')` without any transpiler. This eliminates the need for sucrase, esbuild, or any bundled transpilation library.

**Tested and working:**
```
./dist/pkg-poc-native-ts user-project/thinkwell-style.ts

=== TypeScript Thinkwell-Style Script ===
[Agent] Created agent: sentiment-analyzer
Running TypeScript sentiment analysis...
Input: "TypeScript is absolutely fantastic!"
  Score: 4
  Positive: fantastic
=== TypeScript Script Completed ===
```

## Proposal

### Migration Strategy

Replace the current Bun-based binary build with pkg:

**Current (Bun):**
```bash
bun build --compile --target=bun-darwin-arm64 src/cli/main.ts -o thinkwell
```

**Proposed (pkg):**
```bash
pkg src/cli/main.js --targets node24-macos-arm64 --options experimental-strip-types -o thinkwell
```

### Module Resolution Architecture

The CLI will use a custom `require` function that routes imports appropriately:

```javascript
// src/cli/loader.js
function createCustomRequire(scriptDir) {
  return function customRequire(moduleName) {
    // Bundled thinkwell packages
    if (global.__bundled__[moduleName]) {
      return global.__bundled__[moduleName];
    }

    // External packages from user's node_modules
    const resolved = require.resolve(moduleName, {
      paths: [scriptDir, path.join(scriptDir, 'node_modules')]
    });
    return require(resolved);
  };
}
```

### Virtual Module Registry

The CLI entry point registers bundled exports before loading user scripts:

```javascript
// src/cli/main.js
const thinkwell = require('./bundled/thinkwell');
const acpModule = require('./bundled/acp');
const protocolModule = require('./bundled/protocol');

global.__bundled__ = {
  'thinkwell': thinkwell,
  '@thinkwell/acp': acpModule,
  '@thinkwell/protocol': protocolModule,
};
```

### Import Transformation

User scripts using `thinkwell:*` imports will be transformed at load time:

```typescript
// User writes:
import { Agent } from "thinkwell:agent";

// Transformed to:
const { Agent } = global.__bundled__["thinkwell"];
```

This transformation happens in the loader before the script is executed, similar to the current `transformVirtualImports()` in the Bun plugin.

### Build Configuration

**package.json scripts:**
```json
{
  "scripts": {
    "build:binary": "npm run build:binary:darwin-arm64 && npm run build:binary:darwin-x64 && npm run build:binary:linux-x64 && npm run build:binary:linux-arm64",
    "build:binary:darwin-arm64": "pkg dist/cli/main.js --targets node24-macos-arm64 --options experimental-strip-types -o dist-bin/thinkwell-darwin-arm64",
    "build:binary:darwin-x64": "pkg dist/cli/main.js --targets node24-macos-x64 --options experimental-strip-types -o dist-bin/thinkwell-darwin-x64",
    "build:binary:linux-x64": "pkg dist/cli/main.js --targets node24-linux-x64 --options experimental-strip-types -o dist-bin/thinkwell-linux-x64",
    "build:binary:linux-arm64": "pkg dist/cli/main.js --targets node24-linux-arm64 --options experimental-strip-types -o dist-bin/thinkwell-linux-arm64"
  }
}
```

## Trade-offs

### Advantages of pkg

| Aspect | Benefit |
|--------|---------|
| External resolution | User scripts can import from their own node_modules |
| Transitive dependencies | Packages that import other packages work correctly |
| Mature ecosystem | pkg has been production-tested for years |
| Native TypeScript | Node 24's type stripping eliminates transpiler dependency |
| No subprocess | Single process execution (unlike npm distribution's Bun spawn) |

### Disadvantages vs Bun

| Aspect | Impact |
|--------|--------|
| Binary size | ~63 MB (Node 24) vs ~45 MB (Bun) |
| Startup time | Node.js startup is slower than Bun |
| Runtime performance | Node.js is generally slower than Bun for CPU-bound tasks |
| CommonJS focus | pkg works best with CommonJS; ESM has limitations |
| No Bun APIs | Cannot use Bun-specific APIs like `Bun.file()` |

### Runtime Performance Considerations

For thinkwell's use case, the performance trade-offs are acceptable:

1. **IO-bound workloads** — Agent execution is dominated by LLM API calls, not CPU
2. **Startup is one-time** — Scripts typically run for extended periods
3. **Correctness over speed** — External module resolution working correctly is more important than faster startup

## Implementation Plan

### Phase 1: Build Infrastructure

1. Add `@yao-pkg/pkg` as a dev dependency
2. Create `scripts/build-binary.js` using pkg
3. Update CI to build binaries with pkg instead of Bun
4. Test on all target platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64)

### Phase 2: Loader Implementation

1. Port `transformVirtualImports()` to work with Node's module system
2. Implement custom require function with bundled module resolution
3. Create vm-based loader for custom require injection
4. Handle shebang stripping for executable scripts

### Phase 3: TypeScript Support

1. Verify Node 24's `--experimental-strip-types` works for all user script patterns
2. Test with complex TypeScript (generics, type-only imports, decorators)
3. Document any TypeScript limitations (enums, namespaces)
4. Consider `--experimental-transform-types` for full TypeScript support if needed

### Phase 4: npm Distribution Update

1. Update npm package to detect whether running via pkg binary or npm
2. Maintain subprocess spawn for npm distribution (spawns `bun` or `node` with appropriate flags)
3. Ensure identical behavior between distributions

### Phase 5: Testing and Documentation

1. Port existing binary tests to use pkg-built binaries
2. Add integration tests for external module resolution
3. Update installation documentation
4. Update cli-distribution.md RFD with new architecture

## Open Questions

### ESM Support

**Question:** Can pkg handle ES modules for user scripts?

**Current understanding:**
- pkg's ESM support has known issues ([#16](https://github.com/yao-pkg/pkg/issues/16))
- Dynamic `import()` may fail with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`
- Recommended workaround is pre-bundling with esbuild or using CommonJS

**Options to investigate:**
1. Use CommonJS `require()` exclusively (our proof-of-concept does this successfully)
2. Pre-bundle user scripts with esbuild before execution
3. Use Node.js 22+'s improved ESM support with pkg's `--sea` flag
4. Wait for pkg's ESM improvements (PR #192)

**Recommendation:** Start with CommonJS-based loading since it works reliably. Investigate ESM as a follow-up.

### Windows Support

**Question:** Does this approach work on Windows?

**Current status:** Not tested. pkg supports Windows (win32-x64), but:
- Path handling differs (`C:\snapshot\` vs `/snapshot/`)
- Native TypeScript stripping should work identically
- `require.resolve()` with paths should work

**Recommendation:** Add Windows to the test matrix but defer as lower priority.

### @JSONSchema Processing

**Question:** How will @JSONSchema type processing work?

**Current approach:** The Bun plugin's `onLoad` hook processes TypeScript files to inject schema namespaces.

**Proposed approach:**
1. Read TypeScript source from disk
2. Process with ts-json-schema-generator (same as current)
3. Inject namespace declarations
4. Execute with vm.runInThisContext() or Module._compile()

This should work identically since the schema processing is independent of the runtime.

## Comparison with Alternatives

### Keep Bun + subprocess

**Description:** Accept the limitation; use subprocess spawn for npm distribution.

**Pros:** No migration needed
**Cons:** Binary distribution remains broken; subprocess adds latency

### Wait for Bun fixes

**Description:** Wait for Bun to implement `--embed-dir` or fix module resolution.

**Pros:** Eventually get Bun's performance benefits
**Cons:** No timeline; may never happen; blocks users now

### Node.js SEA (Single Executable Applications)

**Description:** Use Node.js native single executable feature.

**Pros:** Native Node.js support; no third-party tool
**Cons:** Requires bundling to single file; limited asset embedding; less mature than pkg

### Deno

**Description:** Migrate to Deno which has `deno compile --include`.

**Pros:** Modern runtime; good module resolution
**Cons:** Major migration; different APIs; TypeScript handling differs

## References

- [yao-pkg/pkg GitHub](https://github.com/yao-pkg/pkg)
- [Node.js Native TypeScript](https://nodejs.org/en/learn/typescript/run-natively)
- [Bun Issue #5445: --embed-dir](https://github.com/oven-sh/bun/issues/5445)
- [Bun Issue #13405: resolveSync bug](https://github.com/oven-sh/bun/issues/13405)
- [pkg Issue #16: ESM support](https://github.com/yao-pkg/pkg/issues/16)
- [Proof-of-concept: experiments/pkg-poc/](../experiments/pkg-poc/)
- [RFD: Binary Distribution Module Resolution](./binary-module-resolution.md)
- [RFD: CLI Distribution](./cli-distribution.md)

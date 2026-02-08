# RFD: Node-Native Developer Experience

**Depends on:** [remove-uri-scheme](remove-uri-scheme.md)

## Summary

This document proposes a build-time tooling experience for TypeScript developers who want to use thinkwell within their existing Node.js workflows — using their own `node`, `tsc`, `tsx`, or other tooling — without installing thinkwell as a global CLI. The key design constraint is **one programming model**: users write the same code regardless of whether they run via the thinkwell CLI or standard Node tooling. The only difference is a small amount of `package.json` configuration.

## Problem Statement

Today, thinkwell's primary UX is the CLI: `thinkwell myscript.ts` or `thinkwell build`. The CLI handles source transformations at load time — most importantly, `@JSONSchema` processing that injects namespace declarations like `Greeting.Schema` alongside user-defined interfaces.

Many TypeScript developers have mature workflows built around standard Node tooling — `tsx`, `vitest`, `jest`, direct `node --experimental-transform-types`, etc. — and don't want a separate CLI runtime. We need to support these users without creating a second dialect of thinkwell TypeScript.

### The Dialect Problem

An earlier version of this design proposed generating companion files (`types.schemas.ts`) with exports like `GreetingSchema` that users would import explicitly. This creates two incompatible programming models:

| | CLI workflow | Node-native workflow |
|---|---|---|
| Usage | `Greeting.Schema` | `import { GreetingSchema } from "./types.schemas.js"` |
| Import | (none — namespace merges onto the type) | Explicit companion import |

This means example code, documentation, tutorials, and Stack Overflow answers would all need to say "if you're using the CLI, write it this way; if you're using Node, write it this other way." That's an unacceptable tax on the programming model. We should have one way to write thinkwell code.

### Why TypeScript Can't Help Us Directly

TypeScript's module system does not support declaration merging across file boundaries. You can't put `namespace Greeting { export const Schema = ... }` in a separate file and have it merge with `interface Greeting` in the user's source. This is [by design](https://github.com/Microsoft/TypeScript/issues/9611) — modules don't merge.

This means the only way to achieve `Greeting.Schema` is to have the namespace declaration **in the same file** as the interface. The CLI does this via runtime transformation into temp files. For the node-native workflow, we need to do the same transformation at build time.

### Prerequisite: Remove `thinkwell:*` URI Scheme

**This RFD depends on [remove-uri-scheme](remove-uri-scheme.md) being implemented first.** The entire node-native workflow relies on imports using standard npm package specifiers (`"thinkwell"`, `"@thinkwell/acp"`) that `tsc` can resolve natively. If user code still contains `thinkwell:*` imports, the staged files would contain specifiers that `tsc` cannot resolve — the build would fail. Once the URI scheme is removed, the only remaining transformation that needs build-time support is `@JSONSchema` namespace injection.

## Design Goals

1. **One programming model** — Users write `Greeting.Schema` regardless of workflow. The same source file works with both `thinkwell src/main.ts` and `tsx src/main.ts` (after a build step).

2. **Standard imports** — Users import from `"thinkwell"` and `"@thinkwell/acp"` like any other npm package. No custom URI schemes, no special resolution.

3. **Composable with existing tooling** — The build step fits naturally into `package.json` scripts, pre-commit hooks, CI pipelines, and watch-mode workflows.

4. **Source files are sacred** — The user's original `.ts` files are never modified. Transformations are applied to copies in a staging directory.

5. **Good developer experience** — Source maps, IDE navigation, and debugging should work correctly, pointing back to the user's original files.

## Proposal

### The Core Idea

A new build tool that copies the user's TypeScript source into a staging directory, applies `@JSONSchema` namespace injection, and then invokes `tsc` on the staged files. The user's original sources are never touched. TypeScript compiles the transformed files and produces `.js` and `.d.ts` output in the project's `outDir`.

This command reclaims the name `thinkwell build` — currently used for compiling standalone binaries — for the standard tsc-based build that node-native developers expect. The existing binary compilation functionality is renamed to `thinkwell bundle`. See [CLI Interface: `build` vs `bundle`](#cli-interface-build-vs-bundle) below for the full rationale.

The user writes exactly the same code they'd write for the CLI:

```typescript
import { Agent } from "thinkwell";

/**
 * A friendly greeting.
 * @JSONSchema
 */
export interface Greeting {
  message: string;
}

const greeting = await agent
  .think(Greeting.Schema)
  .text("Say hello!")
  .run();
```

### How It Works

```
┌───────────────────────────────────────────────────────────────────────┐
│ thinkwell build                                                       │
│                                                                       │
│  1. Read tsconfig.json from user's project                            │
│  2. Copy source files to .thinkwell/staged/                           │
│  3. Transform staged copies:                                          │
│     • @JSONSchema → inject namespace declarations                     │
│  4. Generate tsconfig for staged files (inherits user's config)       │
│  5. Run tsc on staged directory                                       │
│  6. Output goes to user's configured outDir                           │
│                                                                       │
│  src/                     .thinkwell/staged/src/          dist/       │
│  ├── types.ts       ──►   ├── types.ts (+ namespace)  ──► ├── types.js│
│  ├── main.ts        ──►   ├── main.ts (copied)        ──► ├── main.js │
│  └── tsconfig.json        └── tsconfig.json (generated)   └── ...     │
│  (never modified)         (ephemeral)                     (output)    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Staged Transformation Details

For each `.ts` file copied to the staging directory, the build tool applies `@JSONSchema` namespace injection (reusing the existing `transformJsonSchemas()` from `schema.ts`):

```typescript
// Original (src/types.ts):
/** @JSONSchema */
export interface Greeting {
  message: string;
}

// Staged (.thinkwell/staged/src/types.ts):
import type * as $$__thinkwell__acp__$$ from "@thinkwell/acp";

/** @JSONSchema */
export interface Greeting {
  message: string;
}
namespace Greeting {
  export const Schema: $$__thinkwell__acp__$$.SchemaProvider<Greeting> = {
    toJsonSchema: () => ({
      type: "object",
      properties: {
        message: { type: "string" }
      },
      required: ["message"]
    }) as $$__thinkwell__acp__$$.JsonSchema,
  };
}
```

Files that don't contain `@JSONSchema` are copied unchanged.

### Source Maps

The staged files are structurally identical to the originals, with injected code added after type declarations. TypeScript's source maps will point to the staged files, but because the user's code is at the same line numbers (the namespace injection is appended after each type declaration, not prepended), the mapping is straightforward. We can post-process source maps to rewrite paths from `.thinkwell/staged/src/...` back to `src/...`.

### Example Workflow

**package.json:**
```json
{
  "scripts": {
    "build": "thinkwell build",
    "dev": "thinkwell build --watch",
    "test": "thinkwell build && vitest"
  },
  "devDependencies": {
    "thinkwell": "^0.5.0"
  }
}
```

**Development cycle:**
```bash
npm install
npm run dev          # watches source, rebuilds on changes
# ... edit src/types.ts, add @JSONSchema types
# ... staged files update automatically, tsc recompiles
```

### Dev Mode: Running Without Compilation

For quick iteration without a full `tsc` build — e.g., running a script directly with `tsx` or `node --experimental-transform-types` — we also support a lighter-weight mode:

```bash
thinkwell build --staged-only    # transform to staging dir, don't run tsc
tsx .thinkwell/staged/src/main.ts
```

Or more concisely, if we provide a wrapper:

```bash
thinkwell run --node-native src/main.ts
# equivalent to: stage the file, then exec tsx on the staged version
```

However, the primary workflow for node-native users is the full `tsc` build, since they presumably care about type-checking and `.js`/`.d.ts` output.

### CLI Interface: `build` vs `bundle`

The existing `thinkwell build` command compiles to standalone binaries (esbuild + pkg). We rename that to `thinkwell bundle`, which is the standard JavaScript ecosystem term for producing a self-contained artifact. This frees `thinkwell build` for the standard tsc-based build that node-native developers expect.

The `bundle` command supports two output modes:

```
thinkwell build              # tsc-based build (stages + tsc, this RFD)
thinkwell bundle             # self-contained JS bundle (esbuild, single .js file)
thinkwell bundle --binary    # self-contained binary executable (esbuild + pkg)
```

This naming is precise and idiomatic: "build" is what TypeScript developers type every day, while "bundle" specifically means producing a self-contained artifact — exactly what bundlers like esbuild, ncc, and webpack do. The `--binary` flag escalates from a JS bundle to a compiled executable, which is the less common need.

**Breaking change:** This is a backwards-incompatible rename. Existing users of `thinkwell build <entry>` (for binary compilation) will need to update to `thinkwell bundle <entry>`, and the `thinkwell.build` key in `package.json` moves to `thinkwell.bundle`. Since thinkwell is pre-1.0, this is an acceptable trade-off — and `bundle` is a more accurate name for what that command actually does.

### Configuration

The build tool reads the user's existing `tsconfig.json` to understand their compiler options (`outDir`, `target`, `module`, `strict`, etc.). The generated tsconfig for the staging directory extends the user's config:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "../../dist",
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

Additional thinkwell-specific configuration can go in `package.json`:

```json
{
  "thinkwell": {
    "build": {
      "src": "src",
      "staged": ".thinkwell/staged",
      "include": ["src/**/*.ts"],
      "exclude": ["**/*.test.ts", "**/__fixtures__/**"]
    }
  }
}
```

By default, all files under `src` are staged. The optional `include` and `exclude` fields accept glob patterns for controlling which files are copied to the staging directory. This is useful for skipping test files, fixtures, or other sources that don't need `@JSONSchema` processing or tsc compilation through thinkwell.

Or in `tsconfig.json` as a convention (though tsc will ignore unknown keys):

```json
{
  "compilerOptions": { ... },
  "thinkwell": {
    "src": "src"
  }
}
```

### Watch Mode

```bash
thinkwell build --watch
```

Watch mode:
1. Watches the source directory for `.ts` file changes
2. Re-stages only changed files (incremental)
3. Runs `tsc --watch` on the staged directory
4. Debounces rapid changes

This provides the same experience as `tsc --watch` but with thinkwell transformations applied.

## How This Interacts with the CLI Workflow

The CLI workflow (`thinkwell src/main.ts`) continues to work exactly as it does today — runtime transformation, no build step needed. The node-native workflow adds a build step but uses the same source code.

| Aspect | CLI workflow | Node-native workflow |
|---|---|---|
| User code | `Greeting.Schema` | `Greeting.Schema` (identical) |
| Imports | `"thinkwell"`, `"@thinkwell/acp"` | Same |
| `@JSONSchema` | Runtime injection | Build-time injection |
| Build step | None | `thinkwell build` (stages + tsc) |
| Run command | `thinkwell src/main.ts` | `node dist/main.js` or `tsx src/main.ts` via staged |
| Type checking | Via tsc (on staged files) or VS Code extension | Via `tsc` (on staged files) |
| IDE support | VS Code extension ([vscode-ts-plugin](vscode-ts-plugin.md)) | Same VS Code extension |

### IDE Support

IDE support for `@JSONSchema` augmentations is covered by a separate effort: the Thinkwell VS Code extension with a TypeScript Language Service plugin ([vscode-ts-plugin](vscode-ts-plugin.md)). The extension presents virtual namespace augmentations to TypeScript so that `Greeting.Schema` is visible in the editor without generating files on disk or requiring the staging directory to be in sync.

This works identically for both workflows — the VS Code extension doesn't care whether the user runs scripts via the thinkwell CLI or standard Node tooling. The migration path to TypeScript 7's `tsgo` is covered in [tsgo-api-migration](tsgo-api-migration.md).

## Architecture

### Reuse of Existing Infrastructure

The build tool reuses the core `@JSONSchema` transformation functions from `schema.ts`:

| Existing Function | Used By |
|---|---|
| `findMarkedTypes()` | Both CLI and build tool |
| `generateSchemas()` | Both CLI and build tool |
| `generateInsertions()` | Both CLI and build tool |
| `applyInsertions()` | Both CLI and build tool |
| `generateSchemaImport()` | Both CLI and build tool |
| `transformJsonSchemas()` | Both CLI and build tool (top-level orchestrator) |

The build tool adds orchestration logic around these: file copying, staging directory management, tsconfig generation, tsc invocation, watch mode, and source map fixup.

### Staging Directory Layout

```
project/
├── src/
│   ├── types.ts          # user's source (never modified)
│   ├── main.ts           # user's source
│   └── utils/
│       └── helpers.ts
├── .thinkwell/
│   └── staged/
│       ├── src/
│       │   ├── types.ts      # transformed copy
│       │   ├── main.ts       # transformed copy
│       │   └── utils/
│       │       └── helpers.ts
│       └── tsconfig.json     # generated, extends ../../tsconfig.json
├── dist/                     # tsc output
├── tsconfig.json             # user's tsconfig
└── package.json
```

The `.thinkwell/` directory should be gitignored (the `thinkwell init` template already gitignores `.thinkwell/`-style directories).

### Incremental Staging

To avoid unnecessary work:

1. **Hash check** — Before writing a staged file, compare the transformed content against the existing staged file. Only write if different.
2. **Modification time** — Track source file mtimes to skip re-reading files that haven't changed.
3. **tsc incremental** — The staged tsconfig enables `"incremental": true` so tsc's own incremental compilation kicks in.

## Trade-offs

### Advantages

| Aspect | Benefit |
|---|---|
| One programming model | `Greeting.Schema` works everywhere — no dialect split |
| Familiar tooling | Uses tsc under the hood; developers understand the output |
| Reuses existing code | Same transformation functions as the CLI |
| Full type checking | tsc runs on complete, valid TypeScript (with namespace merges) |
| Source map support | Output maps back to original source files |

### Disadvantages

| Aspect | Impact |
|---|---|
| Staging directory | Adds a `.thinkwell/staged/` directory (gitignored, but still disk usage) |
| Build step required | Must run `thinkwell build` before running compiled output |
| Source map complexity | Need to rewrite source map paths from staged → original |
| Duplicated files | Every source file is copied to the staging directory, even files with no transformations |

### Why Not Companion Files?

An earlier version of this design proposed generating companion `.schemas.ts` files with exports like `GreetingSchema`. This was rejected because it creates a programming model split: CLI users write `Greeting.Schema` while node-native users write `import { GreetingSchema }`. Having one way to write thinkwell code is more important than avoiding a staging directory.

### Why Not a Custom Node Loader?

Node.js supports custom ESM loaders via `--loader` or `register()`. We considered providing a thinkwell loader that performs transformations at import time. This was rejected because:

1. **Loader API instability** — Node's loader API has changed significantly across versions and remains experimental.
2. **Tooling incompatibility** — Custom loaders interact poorly with tsx, vitest, jest, and bundlers.
3. **Debugging friction** — Cryptic errors when loaders misbehave.
4. **No type checking** — A loader can make code run, but tsc still wouldn't see the namespace merges. You'd need the staging approach anyway for type-checking.

### Why Not ts-patch or Custom TypeScript Transformers?

ts-patch allows program-level transformers that can inject files into the compilation. This could theoretically inject namespace declarations. However:

1. **Patches the TypeScript installation** — Requires `ts-patch install` as a setup step, which modifies `node_modules`.
2. **Fragile across TypeScript versions** — Patches may break on TypeScript upgrades.
3. **No runtime code** — TypeScript transformers operate during emit; they can't inject runtime values (the `Schema` property needs to actually exist at runtime, not just type-check).

## References

- [RFD: Remove `thinkwell:*` URI Scheme](./remove-uri-scheme.md)
- [RFD: VSCode Extension with TypeScript Plugin](./vscode-ts-plugin.md)
- [RFD: Migrate to `tsgo` IPC API](./tsgo-api-migration.md)
- [RFD: Schema Provider Interface](./schema-providers.md)
- [RFD: CLI Distribution](./cli-distribution.md)
- [RFD: `thinkwell bundle` Command](./user-build-command.md)
- [TypeScript Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [ts-json-schema-generator](https://www.npmjs.com/package/ts-json-schema-generator)
- [TypeScript #9611: Modules don't allow merging](https://github.com/Microsoft/TypeScript/issues/9611)

# Implementation Plan: Migrate Binary Distribution from Bun to pkg

This plan implements the design in [doc/rfd/pkg-migration.md](rfd/pkg-migration.md).

## Phase 1: Build Infrastructure

- [x] Add `@yao-pkg/pkg` as a dev dependency to `packages/thinkwell`
- [x] Create `packages/thinkwell/scripts/build-binary-pkg.ts` build script
- [x] Add pkg build scripts to package.json (darwin-arm64, darwin-x64, linux-x64, linux-arm64)
- [x] Configure pkg in package.json (assets, scripts, targets)
- [x] Test that pkg can bundle the existing CLI entry point

## Phase 2: Loader Implementation

- [x] Create `packages/thinkwell/src/cli/loader.ts` with custom require function
- [x] Implement `createCustomRequire(scriptDir)` for bundled vs external resolution
- [x] Create `global.__bundled__` registry initialization
- [x] Port `transformVirtualImports()` from bun-plugin to work with string replacement
- [x] Implement script loading via `vm.runInThisContext()` with custom require injection
- [x] Handle shebang stripping for executable user scripts

## Phase 3: CLI Entry Point

- [x] Expand `packages/thinkwell/src/cli/main-pkg.cjs` with full CLI functionality
- [x] Register bundled thinkwell packages to `global.__bundled__`
- [x] Integrate loader for user script execution
- [x] Support all existing commands: `init`, `types`, `run` (default)
- [x] Ensure `init` command works (already pure Node.js)

Note: Script execution now works after Phase 4 resolved pkg's ESM bundling
limitations by pre-bundling thinkwell packages into CJS format.

## Phase 4: TypeScript Support

- [x] Test Node 24's `--experimental-strip-types` with pkg `--options` flag
- [x] Verify user `.ts` scripts work with type stripping
- [x] Test complex TypeScript patterns (generics, type-only imports)
- [x] Document unsupported TypeScript features (enums, namespaces, decorators)
- [x] Consider `--experimental-transform-types` as fallback if needed

### Implementation Notes (Phase 4)

**ESM bundling solution**: pkg doesn't properly resolve ESM imports inside its
`/snapshot/` virtual filesystem. Solution: pre-bundle thinkwell packages into
CJS format using esbuild (`scripts/bundle-for-pkg.ts` → `dist-pkg/*.cjs`).

**TypeScript loading strategy**: Two paths based on whether transformation needed:
1. **Direct require()** - Scripts without thinkwell imports use Node's native
   type stripping via direct `require()`.
2. **Transform + temp file** - Scripts with `thinkwell:*` or bundled package
   imports are transformed, written to a temp file, then required.

**Supported TypeScript features** (strip-only mode):
- Type annotations, interfaces, type aliases
- Generic functions and classes (no parameter properties)
- Type-only imports (`import type {...}`, inline `type` specifier)
- Type assertions (`as` keyword)

**Unsupported features** (require `--experimental-transform-types`):
- Enums (regular and const)
- Namespaces
- Parameter properties (`constructor(public x: number)`)
- Legacy decorators
- JSX in `.ts` files

**Decision on transform-types**: Not implementing as fallback. The unsupported
features are uncommon in modern TypeScript, and documenting them is sufficient.
Users needing these features can pre-compile their scripts.

## Phase 5: @JSONSchema Processing

- [x] Port schema generation from bun-plugin to work standalone
- [x] Read TypeScript source, process with ts-json-schema-generator, inject namespace
- [x] Integrate schema processing into the loader pipeline
- [x] Test with existing @JSONSchema examples

### Implementation Notes (Phase 5)

**Schema module location**: Created `packages/thinkwell/src/cli/schema.ts` as a
standalone port of the schema generation from bun-plugin. The module includes:
- `findMarkedTypes()` - TypeScript AST traversal to find @JSONSchema-marked types
- `generateSchemas()` - Uses ts-json-schema-generator to create JSON schemas
- `generateInsertions()` - Creates namespace declarations with SchemaProvider
- `transformJsonSchemas()` - Main entry point that orchestrates the pipeline

**Bundling approach**: The CLI loader (including schema module) is pre-bundled
into `dist-pkg/cli-loader.cjs` using esbuild. This bundles ts-json-schema-generator
and typescript into a single CJS file (~11MB) that pkg can resolve correctly.

**TypeScript mode change**: Switched from `--experimental-strip-types` to
`--experimental-transform-types` because @JSONSchema generates TypeScript
namespace declarations, which require transformation (not just stripping).
This enables full TypeScript support including namespaces, enums, and decorators.

**Dependencies added**: Added `ts-json-schema-generator` and `typescript` as
direct dependencies of the thinkwell package (previously only in bun-plugin).

## Phase 6: npm Distribution Update

- [x] Rewrite `packages/thinkwell/bin/thinkwell` launcher to use Node.js directly
- [x] Remove Bun subprocess spawn (Bun cannot resolve user's node_modules)
- [x] Use the same pkg-style loader infrastructure for npm distribution
- [x] Update package.json files array to include dist-pkg
- [x] Ensure identical behavior between npm and binary distributions

### Implementation Notes (Phase 6)

**Strategy change**: Originally planned to detect pkg vs npm mode and maintain Bun
for npm distribution. This was revised because Bun's compiled binary has a fundamental
limitation: it cannot resolve packages from the user's `node_modules` directory.
Both distributions now use the same Node.js-based execution path with the pkg-style
loader, ensuring consistent behavior.

**Unified execution path**: Both the npm distribution (`bin/thinkwell`) and the pkg
binary (`main-pkg.cjs`) now use:
- Pre-bundled thinkwell packages from `dist-pkg/*.cjs`
- The CLI loader (`dist-pkg/cli-loader.cjs`) for script execution
- Node 24's `--experimental-transform-types` for TypeScript support
- The same import transformation and @JSONSchema processing pipeline

**Package distribution**: Added `dist-pkg` to the `files` array in package.json so
the pre-bundled CJS packages are included in the npm distribution. This allows the
npm-installed version to use the same loader as the pkg binary.

**Runtime requirements**: The npm distribution now requires Node.js 24+ (previously
required Bun). This is validated at startup with a clear error message directing
users to upgrade Node.js.

## Phase 7: Testing

- [x] Port existing binary tests to use pkg-built binaries
- [x] Add integration test: user script imports from node_modules
- [x] Add integration test: ESM user script via require(esm)
- [x] Add integration test: TypeScript user script
- [x] Add integration test: @JSONSchema type processing
- [x] Test on all target platforms (CI matrix)

### Implementation Notes (Phase 7)

**Test file location**: Created `packages/thinkwell/src/cli/cli.test.ts` with comprehensive
CLI integration tests covering both npm and pkg binary distributions.

**Test coverage** (30 tests total):
- npm distribution tests: help, version, error handling
- pkg binary tests: help, version, script execution
- TypeScript execution: type annotations, interfaces, generics, type-only imports
- thinkwell imports: thinkwell:agent, thinkwell package, @thinkwell/acp
- @JSONSchema processing: basic interfaces, nested objects, Schema namespace
- ESM script execution: JavaScript and TypeScript
- node_modules imports: local modules resolution
- Script arguments: argument passing, run subcommand
- Shebang support: stripping from scripts
- Error handling: syntax errors, runtime errors, missing modules

**CI/CD configuration**:
- Created `.github/workflows/ci.yml` for continuous integration on all platforms
- Updated `.github/workflows/release.yml` to use pkg instead of Bun
- Platforms tested: darwin-arm64, darwin-x64, linux-x64, linux-arm64
- All workflows now use Node.js 24 for TypeScript transform support

**@JSONSchema test note**: Types marked with `@JSONSchema` generate a namespace with
a `Schema` property (e.g., `Person.Schema.toJsonSchema()`), not a direct method on
the type. Tests updated to use the correct API.

## Phase 8: Documentation & Cleanup

- [x] Update installation documentation with pkg binary instructions
- [x] Document top-level await limitation for ESM scripts
- [x] Document unsupported TypeScript features
- [x] Remove or deprecate Bun-specific binary build scripts
- [x] Update cli-distribution.md RFD with new architecture

### Implementation Notes (Phase 8)

**Documentation updates**:
- Updated `doc/installation.md` with Node.js 24 requirements (replacing Bun)
- Added macOS binary download instructions alongside Linux
- Added "Script Limitations" section documenting top-level await and TypeScript features
- Updated CI/CD examples to use Node.js 24 instead of Bun
- Updated troubleshooting section for new error messages

**README.md update**: Changed npm installation note from "requires Bun" to "requires Node.js 24+".

**Build script cleanup**:
- Removed `packages/thinkwell/scripts/build-binary.ts` (Bun-specific)
- Renamed pkg scripts from `build:binary:pkg:*` to `build:binary:*`
- Main `build:binary` script now uses pkg instead of Bun

**RFD update**: Rewrote `doc/rfd/cli-distribution.md` with new architecture:
- Documented unified execution path for npm and binary distributions
- Described module resolution, virtual module registry, and import transformation
- Added build process documentation (pre-bundling + pkg compilation)
- Updated package structure and configuration examples
- Added historical context referencing the pkg-migration RFD

**RFD archive**: Created `doc/rfd/archive/` for obsolete RFDs:
- Moved `bun-schema-plugin.md` → `archive/bun-schema-plugin.md`
- Moved `binary-module-resolution.md` → `archive/binary-module-resolution.md`
- Restored original `cli-distribution.md` from git → `archive/cli-distribution-bun.md`
- Added superseded notices to each archived RFD linking to current docs

## Notes

- Keep existing npm distribution working throughout migration
- pkg binary uses Node 24 with `--experimental-transform-types` (for namespace support)
- ESM support via `require(esm)` - no top-level await in user scripts
- Binary size expected: ~63 MB (vs ~45 MB for Bun)

# Plan: Node-Native Developer Experience

Implements the [node-ux](rfd/node-ux.md) and [check-command](rfd/check-command.md) RFDs.

**Prerequisite:** remove-uri-scheme (PR #28, merged).

## Phase 1: Rename `build` → `bundle`

- [x] Rename `src/cli/build.ts` → `src/cli/bundle.ts`, update exported function names (`runBuild` → `runBundle`, `parseBuildArgs` → `parseBundleArgs`, `showBuildHelp` → `showBundleHelp`)
- [x] Rename `thinkwell.build` config key to `thinkwell.bundle` in config reading logic
- [x] Update `main.cjs` command routing: `"build"` → `"bundle"`, add `"build"` as a placeholder that errors with a migration message until Phase 4 reclaims it
- [x] Update help text to reflect new `bundle` command name
- [x] Update any references in tests, examples, and scripts

## Phase 2: Custom CompilerHost

The shared infrastructure for both `thinkwell build` and `thinkwell check`.

- [ ] Create `src/cli/compiler-host.ts` — custom `ts.CompilerHost` that wraps the default host and intercepts `getSourceFile()` to apply `transformJsonSchemas()` on project files
- [ ] Handle the hybrid pattern: transform project source files, pass through `node_modules` / lib files unchanged
- [ ] Add helper to read and parse user's `tsconfig.json` via `ts.readConfigFile()` + `ts.parseJsonConfigFileContent()`
- [ ] Expose a `createThinkwellProgram(configPath)` function that returns a `ts.Program` wired to the custom host

## Phase 3: `thinkwell check` command

- [ ] Create `src/cli/check.ts` with `runCheck()`, `parseCheckArgs()`, `showCheckHelp()`
- [ ] Implement single-project checking: resolve `tsconfig.json`, create program via CompilerHost, call `ts.getPreEmitDiagnostics()`, format and print diagnostics
- [ ] Implement workspace detection (pnpm-workspace.yaml, package.json `"workspaces"`)
- [ ] Implement `--package` / `-p` flag with name resolution (full name and short name matching)
- [ ] Wire into `main.cjs` command routing
- [ ] Exit codes: 0 (clean), 1 (type errors), 2 (config error)

## Phase 4: `thinkwell build` command (tsc-based)

- [ ] Create `src/cli/build.ts` (the new build, reclaiming the name) with `runBuild()`, `parseBuildArgs()`, `showBuildHelp()`
- [ ] Implement: resolve `tsconfig.json`, create program via CompilerHost, call `program.emit()`, report diagnostics
- [ ] Support `thinkwell.build` config in package.json (`include`/`exclude` globs for controlling which files receive `@JSONSchema` processing)
- [ ] Update `main.cjs` to route `"build"` to the new tsc-based build

## Phase 5: Watch mode

- [ ] Add `--watch` flag to `thinkwell build`
- [ ] Use TypeScript's `ts.createWatchProgram()` with the custom CompilerHost
- [ ] Support incremental compilation (`--incremental` / `.tsbuildinfo`)
- [ ] Add `--watch` flag to `thinkwell check` for continuous type-checking feedback

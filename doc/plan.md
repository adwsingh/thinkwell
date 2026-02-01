# Implementation Plan: CLI Distribution

Based on [RFD: CLI Distribution](rfd/cli-distribution.md)

## Current State

- `thinkwell` npm package (packages/thinkwell) — Core library
- `@thinkwell/cli` npm package (packages/cli) — CLI with Node.js launcher that delegates to Bun
- CLI already implements: `run`, `types`, `--help`, `--version`, Bun detection

## Problem

The RFD calls for `npx thinkwell` to invoke the CLI, but:
- The `thinkwell` package is the library, not the CLI
- The CLI is published as `@thinkwell/cli`, requiring `npx @thinkwell/cli`

## Phase 1: Package Restructuring (Thin Wrapper)

Add CLI bin to `thinkwell` package that re-exports `@thinkwell/cli`:

- [ ] Add `bin/thinkwell.js` wrapper script to packages/thinkwell
- [ ] Add `@thinkwell/cli` as dependency of `thinkwell`
- [ ] Add `bin` field to packages/thinkwell/package.json
- [ ] Test `npx thinkwell` experience locally

## Phase 2: CLI Enhancements

- [ ] Implement `init` command for project scaffolding (no Bun required)
- [ ] Improve Bun-not-found error message per RFD spec
- [ ] Add `build` command (deferred to future PR)
- [ ] Add `check` command (deferred to future PR)

## Phase 3: Homebrew Distribution

- [ ] Create `homebrew-thinkwell` repository
- [ ] Write npm-based Homebrew formula with Bun caveat
- [ ] Test installation via `brew tap` and `brew install`
- [ ] Document Homebrew installation in README

## Phase 4: Documentation

- [ ] Write installation guide with tabbed package manager examples
- [ ] Frame Bun requirement as feature (TypeScript-native, schema generation, compiled executables)
- [ ] Add troubleshooting section for common issues
- [ ] Document CI/CD installation patterns (GitHub Actions example)

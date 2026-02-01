# Implementation Plan: CLI Distribution

Based on [RFD: CLI Distribution](rfd/cli-distribution.md)

## Phase 1: Core npm Package

- [x] Create `thinkwell` package structure with Node-compatible CLI entry point
- [x] Implement argument parsing for core commands (`run`, `init`, `types`, `--help`, `--version`)
- [x] Implement Bun runtime detection with helpful error messages
- [x] Implement `run` command that spawns Bun with the thinkwell plugin
- [x] Implement `init` command for project scaffolding (no Bun required)
- [x] Add `engines` field requiring Node >= 18
- [ ] Publish to npm under the `thinkwell` package name

## Phase 2: Homebrew Distribution

- [ ] Create `homebrew-thinkwell` repository
- [ ] Write npm-based Homebrew formula with Bun caveat
- [ ] Test installation via `brew tap` and `brew install`
- [ ] Document Homebrew installation in README

## Phase 3: Documentation

- [ ] Write installation guide with tabbed package manager examples
- [ ] Frame Bun requirement as feature (TypeScript-native, schema generation, compiled executables)
- [ ] Add troubleshooting section for common issues
- [ ] Document CI/CD installation patterns (GitHub Actions example)

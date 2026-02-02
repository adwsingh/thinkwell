# Implementation Plan: CLI Distribution

Based on [RFD: CLI Distribution](rfd/cli-distribution.md)

## Phase 1: Pre-release npm Package

- [x] Create `thinkwell` package structure with Node-compatible CLI entry point
- [x] Implement argument parsing for core commands (`run`, `init`, `types`, `--help`, `--version`)
- [x] Implement Bun runtime detection with helpful error messages
- [x] Implement `run` command that spawns Bun with the thinkwell plugin
- [x] Implement `init` command for project scaffolding (no Bun required)
- [x] Add `engines` field requiring Node >= 18
- [x] Publish pre-release (`0.3.0-alpha.1`) to npm with `next` tag
- [x] Test CLI installation via `npx thinkwell@next`

## Phase 2: Homebrew Distribution

- [ ] Create `homebrew-thinkwell` repository
- [ ] Write npm-based Homebrew formula with Bun caveat
- [ ] Build and test self-contained binary executables
- [ ] Test installation via `brew tap` and `brew install`

## Phase 3: Stable Release

- [ ] Iterate with additional pre-release versions as needed
- [ ] Publish stable `0.3.0` to npm under `latest` tag
- [ ] Update Homebrew formula to point to stable release

## Phase 4: Documentation

- [ ] Write installation guide with tabbed package manager examples
- [ ] Frame Bun requirement as feature (TypeScript-native, schema generation, compiled executables)
- [ ] Add troubleshooting section for common issues
- [ ] Document CI/CD installation patterns (GitHub Actions example)

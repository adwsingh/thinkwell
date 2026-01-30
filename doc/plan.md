# Implementation Plan: Thinkwell CLI and Bun Plugin

This plan tracks the implementation of the `thinkwell` CLI and Bun plugin for automatic schema generation, as described in [RFD: Thinkwell CLI and Bun Plugin](./rfd/bun-schema-plugin.md).

## Phase 1: Core Plugin

- [ ] Create `@thinkwell/bun-plugin` package structure
- [ ] Implement `onLoad` hook with `@JSONSchema` detection
- [ ] Integrate ts-json-schema-generator for schema extraction
- [ ] Generate namespace injections
- [ ] Add basic mtime-based caching

## Phase 2: CLI

- [ ] Create `thinkwell` CLI package
- [ ] Implement Bun delegation with plugin preload
- [ ] Add `--help` and `--version` flags
- [ ] Set up npm distribution with Node.js launcher
- [ ] Test shebang support across platforms (macOS, Linux)

## Phase 3: IDE Support

- [ ] Generate ambient `.d.ts` files for type checking
- [ ] Add file watcher to regenerate declarations on changes
- [ ] Document tsconfig.json setup for IDE integration

## Phase 4: Cross-File Types

- [ ] Use `ts.createProgram()` for full type resolution
- [ ] Handle imported types with `@JSONSchema`
- [ ] Cache TypeScript program for performance

## Phase 5: Polish

- [ ] Error messages and diagnostics
- [ ] Source map support (if needed)
- [ ] Performance profiling and optimization
- [ ] Documentation and examples

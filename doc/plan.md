# Implementation Plan: SchemaProvider Interface

This plan implements the `SchemaProvider<T>` interface from [schema-providers.md](rfd/schema-providers.md).

## Phase 1: Core Types

- [ ] Add `SchemaProvider<T>` interface to `packages/sacp/src/types.ts`
- [ ] Ensure `JsonSchema` type has index signature for third-party compatibility
- [ ] Export `SchemaProvider` from `packages/sacp/src/index.ts`
- [ ] Re-export `SchemaProvider` from `packages/patchwork/src/index.ts`

## Phase 2: Helper Function

- [ ] Add `schemaOf<T>()` helper function to patchwork (new file `packages/patchwork/src/schema.ts`)
- [ ] Export `schemaOf` from patchwork index

## Phase 3: Update ThinkBuilder API

- [ ] Add new `think(schema: SchemaProvider<T>)` overload to Patchwork class
- [ ] Update ThinkBuilder to accept schema in constructor
- [ ] Deprecate `.outputSchema()` method with console warning
- [ ] Update internal schema handling to use `toJsonSchema()` when building request

## Phase 4: Tests

- [ ] Add unit tests for `schemaOf<T>()` helper
- [ ] Add unit tests for `think(schema)` signature
- [ ] Add test demonstrating type inference flow
- [ ] Verify deprecation warning fires for `.outputSchema()`

## Phase 5: Documentation

- [ ] Update patchwork README with new usage patterns
- [ ] Add JSDoc comments to `SchemaProvider` and `schemaOf`

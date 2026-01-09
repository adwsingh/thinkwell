# Implementation Plan: Agent-Centric API

RFD: [doc/rfd/agent-api.md](rfd/agent-api.md)

## Tasks

- [ ] Add `Agent` class with `connect()` static method
- [ ] Implement conductor auto-discovery (PATH lookup, env var)
- [ ] Move `think()` method from `Patchwork` to `Agent`
- [ ] Add `Session` class with `think()` method for multi-turn
- [ ] Implement `agent.createSession()` returning `Session`
- [ ] Update `ThinkBuilder` to work with both `Agent` and `Session`
- [ ] Deprecate `Patchwork` class and `connect()` function
- [ ] Update examples to use new API
- [ ] Update package exports

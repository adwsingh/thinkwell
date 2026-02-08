# RFD: Migrate VSCode Extension to `tsgo` IPC API

**Depends on:** [vscode-ts-plugin](vscode-ts-plugin.md)

## Summary

Migrate the Thinkwell VSCode extension from the TypeScript Language Service Plugin API (which TypeScript 7 discontinues) to the new `tsgo` IPC-based API. The `tsgo` API provides a sanctioned mechanism for virtual file provision via `callbackfs`, enabling the same `@JSONSchema` augmentation without monkey-patching — and with a stable foundation for the TypeScript Go era.

This RFD is forward-looking. The `tsgo` API is in early prototype as of February 2026. The timeline for this migration depends on API stabilization, but the architectural direction is clear and the necessary primitives are being built.

## Background

### The TypeScript 7 Transition

TypeScript is being rewritten in Go (codename "Corsa"). TypeScript 7.0 ships mid-March 2026 alongside TypeScript 6.0 (the final JavaScript-based release):

| Version | Language | Editor service | Plugin API |
|---|---|---|---|
| TypeScript 5.x/6.x | JavaScript | tsserver (custom protocol) | TS Language Service Plugin (JS-based) |
| TypeScript 7.x | Go | `tsgo` (native LSP) | IPC-based API (new) |

The existing TS plugin API is fundamentally incompatible with the Go binary — there is no way to load JavaScript plugin code into a compiled Go process. This affects every framework that extends TypeScript: Vue/Volar, Svelte, Angular, and Thinkwell.

### The Coexistence Window

TypeScript 6.x will be maintained indefinitely with no hard sunset date. Users can run both versions side-by-side: TypeScript 6.x for tooling that needs the old API, and `tsgo` for fast type-checking. This provides a long runway for migration, but the direction is clear — the Go port is the future.

### Current State of the `tsgo` API

Two merged PRs establish the foundation:

**[PR #711](https://github.com/microsoft/typescript-go/pull/711): IPC API scaffold**
- Synchronous Node.js client communicating with `tsgo` over STDIO
- AST access, symbol resolution, type queries via opaque object handles
- Two packages: `@typescript/ast` (node definitions) and `@typescript/api` (client)

**[PR #2620](https://github.com/microsoft/typescript-go/pull/2620): Async API and LSP integration**
- `custom/initializeAPISession` LSP command — a VSCode extension can request an API connection to the running `tsgo` language server
- The API session shares the same type checker state as the editor's LSP session
- `callbackfs` — a callback-based virtual filesystem over IPC, implementing `ReadFile`, `FileExists`, `DirectoryExists`, `GetAccessibleEntries`, and `Realpath`
- Explicitly positioned as "the beginnings of a path toward replacing TS Server plugins"

## The `callbackfs` Mechanism

This is the key primitive for Thinkwell's migration. When `tsgo` needs to read a file, `callbackfs` intercepts the read and delegates to the IPC client:

```
tsgo language server                    Thinkwell extension
        │                                       │
        │  ReadFile("project/greeting.ts")      │
        ├──────────────────────────────────────►│
        │                                       │
        │  Returns: original source             │
        │◄──────────────────────────────────────┤
        │                                       │
        │  FileExists("__thinkwell__.d.ts")     │
        ├──────────────────────────────────────►│
        │                                       │
        │  Returns: true                        │
        │◄──────────────────────────────────────┤
        │                                       │
        │  ReadFile("__thinkwell__.d.ts")       │
        ├──────────────────────────────────────►│
        │                                       │
        │  Returns: generated namespace decls   │
        │◄──────────────────────────────────────┤
```

The extension controls what files `tsgo` sees. It can:

1. **Provide virtual declaration files** that don't exist on disk — making `@JSONSchema` namespace merges visible to the type checker
2. **Present transformed source files** if needed — though for Thinkwell's current needs, virtual declarations are sufficient
3. **Make virtual files appear in directory listings** via `GetAccessibleEntries`, so `tsgo` includes them in the project

This achieves the same result as the TS plugin's `getExternalFiles()` + `getScriptSnapshot()` monkey-patching, but through an officially supported, stable API designed for exactly this use case.

## Proposed Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ VSCode                                                           │
│ ┌──────────────────────────────┐  ┌───────────────────────────┐  │
│ │ Thinkwell VSCode Extension   │  │ TypeScript (Native) Ext   │  │
│ │                              │  │ (runs tsgo as LSP)        │  │
│ │ 1. Calls custom/initialize-  │  │                           │  │
│ │    APISession                │  └──────────┬────────────────┘  │
│ │ 2. Registers callbackfs      │             │                   │
│ │    handlers                  │   ┌─────────▼─────────────────┐ │
│ │ 3. Provides virtual .d.ts    ├──►│ tsgo (native LSP server)  │ │
│ │    content on ReadFile       │   │                           │ │
│ │ 4. Scans for @JSONSchema     │   │ callbackfs delegates      │ │
│ │    markers                   │   │ file reads to extension   │ │
│ └──────────────────────────────┘   └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Extension lifecycle

1. **Activation:** The extension activates when a workspace contains `thinkwell` as a dependency.

2. **API session:** The extension calls the `custom/initializeAPISession` LSP command on the `tsgo` language server, receiving a connection (Unix domain socket or named pipe) to an API session that shares the live type checker state.

3. **Filesystem callbacks:** The extension registers `callbackfs` handlers. For most files, it passes through to the real filesystem. For the virtual `__thinkwell_augmentations__.d.ts`, it returns dynamically generated namespace declarations.

4. **Source scanning:** Same as the TS plugin approach — scan project files for `@JSONSchema` markers, generate corresponding namespace merge declarations.

5. **State adoption:** When files change, the extension uses `AdoptLSPState` to pick up the latest type checker snapshot, re-scans affected files, and updates the virtual declarations.

### Dual-version support

During the coexistence period, the extension should support both TypeScript versions:

- **TypeScript ≤6.x (tsserver):** Use the TS Language Service Plugin from [vscode-ts-plugin](vscode-ts-plugin.md)
- **TypeScript 7+ (tsgo):** Use the `callbackfs` API described here

The extension detects which TypeScript version is active and uses the appropriate mechanism. This is the same pattern that VSCode's own TypeScript extension will need to manage during the transition.

## What's Not Yet Available

The `tsgo` API is explicitly described as "early prototype quality." Key gaps as of February 2026:

| Capability | Status | Impact on Thinkwell |
|---|---|---|
| `callbackfs` (virtual files) | Merged (PR #2620) | Core mechanism — available |
| `custom/initializeAPISession` | Merged (PR #2620) | Entry point — available |
| `AdoptLSPState` (state sync) | Merged (PR #2620) | Needed for reactivity — available |
| Diagnostics query | Not yet | Low impact — we provide declarations, tsgo computes diagnostics |
| Completions query | Not yet | Low impact — same reason |
| Custom completions injection | Not yet | Not needed if virtual declarations work |
| "Proper hooks" for framework integration | Acknowledged, not designed | May not be needed for our use case |

The critical observation: **Thinkwell's approach of providing virtual declaration files does not require diagnostics or completions hooks.** We provide the type information; TypeScript's own language service computes the IDE features from it. The primitives we need — `callbackfs`, API session creation, and state adoption — are already merged.

## Open Questions

### API stability timeline

The `tsgo` API is in active development with no stability guarantees. When should we start building against it? Options:

- **Aggressive:** Start now, accept API churn, be an early adopter and provide feedback
- **Conservative:** Wait for an official beta/stability signal, rely on the TS 6.x plugin in the meantime
- **Middle ground:** Build a proof-of-concept now to validate the approach, defer production use until API stabilizes

### Virtual file discovery

How does `tsgo` discover that `__thinkwell_augmentations__.d.ts` should be part of the project? Options:

- The `callbackfs` `GetAccessibleEntries` callback could include it in directory listings
- There may be an API method to register additional files with the project (analogous to `getExternalFiles()`)
- We may need to include it via a `/// <reference>` directive or tsconfig `include` pattern

This depends on `tsgo` API details that may not be finalized yet.

### IPC performance for file reads

Every file read goes through IPC. For most files, the extension will just pass through to the real filesystem, adding latency. Is there a way to only intercept specific files? The `callbackfs` design may support selective interception (only intercepting reads for files that match a pattern), or it may require the extension to handle all reads.

## Timeline Considerations

| Milestone | Estimated timing |
|---|---|
| TypeScript 7.0 ships | Mid-March 2026 |
| `tsgo` API stabilizes for virtual file use cases | Unknown — depends on framework adoption pressure |
| Thinkwell proof-of-concept on `tsgo` API | After API reaches beta quality |
| Thinkwell production migration | After API stability guarantee |
| TS 6.x plugin deprecation | When `tsgo` API has proven stable for ≥1 release cycle |

The TS 6.x plugin provides a working solution during the entire transition. There is no urgency to migrate before the `tsgo` API is ready.

## References

- [PR #711: Scaffold IPC-based API](https://github.com/microsoft/typescript-go/pull/711)
- [PR #2620: Async API and LSP integration](https://github.com/microsoft/typescript-go/pull/2620)
- [Discussion #455: What is the API story?](https://github.com/microsoft/typescript-go/discussions/455)
- [Announcing TypeScript Native Previews](https://devblogs.microsoft.com/typescript/announcing-typescript-native-previews/#api-progress)
- [Progress on TypeScript 7 — December 2025](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [vscode-ts-plugin](vscode-ts-plugin.md) — the TS 5.x/6.x approach this migrates from
- [remove-uri-scheme](remove-uri-scheme.md) — prerequisite for both approaches

# @thinkwell/conductor

TypeScript conductor for ACP proxy chains.

## Overview

The conductor orchestrates message routing between clients, proxies, and agents in the Agent Client Protocol (ACP). It sits between every component, managing process lifecycle and message flow.

```
Client <-> Conductor <-> [Proxy 0] <-> [Proxy 1] <-> ... <-> Agent
```

## Installation

```bash
pnpm add @thinkwell/conductor
```

## Usage

### Basic Usage

```typescript
import { Conductor, fromCommands, ChannelConnector } from '@thinkwell/conductor';

// Create a conductor that spawns an agent subprocess
const conductor = new Conductor({
  instantiator: fromCommands(['my-agent']),
});

// Connect a client
const clientConnector = new ChannelConnector(/* your channel */);
await conductor.connect(clientConnector);
```

### With Proxies

```typescript
const conductor = new Conductor({
  // Last command is the agent, earlier commands are proxies
  instantiator: fromCommands(['my-proxy', 'my-agent']),
});
```

### With Logging

```typescript
const conductor = new Conductor({
  instantiator: fromCommands(['my-agent']),
  logging: {
    level: 'debug', // 'error' | 'warn' | 'info' | 'debug' | 'trace'
    name: 'my-app',
    json: true, // Output as JSON for machine parsing
  },
});
```

### With JSONL Tracing

Write all messages to a JSONL file for debugging:

```typescript
const conductor = new Conductor({
  instantiator: fromCommands(['my-agent']),
  trace: {
    path: '/tmp/conductor-trace.jsonl',
  },
});
```

Each line in the trace file is a JSON object with:
- `timestamp`: ISO 8601 timestamp
- `direction`: `'left-to-right'` | `'right-to-left'` | `'internal'`
- `source`: Source component identifier
- `target`: Target component identifier
- `message`: The full `ConductorMessage` object

### Dynamic Component Selection

```typescript
import { Conductor, dynamic, StdioConnector } from '@thinkwell/conductor';

const conductor = new Conductor({
  instantiator: dynamic(async (initRequest) => {
    // Inspect the initialize request to decide what to spawn
    const needsProxy = initRequest.params?.mcpServers?.length > 0;

    return {
      proxies: needsProxy ? [new StdioConnector('my-proxy')] : [],
      agent: new StdioConnector('my-agent'),
    };
  }),
});
```

## API Reference

### Conductor

Main class that orchestrates the proxy chain.

#### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Optional name for debugging |
| `instantiator` | `ComponentInstantiator` | Creates components on initialization |
| `mcpBridgeMode` | `'http' \| 'disabled'` | MCP bridge mode (default: `'http'`) |
| `logging` | `LoggerOptions` | Logging configuration |
| `trace` | `TraceOptions` | JSONL trace output configuration |

#### Methods

- `connect(clientConnector)`: Connect to a client and run the message loop
- `shutdown()`: Shut down the conductor and all components

### Instantiators

Factory functions for creating component configurations:

- `fromCommands(commands)`: Create from a list of command strings (last is agent)
- `fromConnectors({ proxies, agent })`: Create from explicit connectors
- `staticInstantiator(config)`: Create with detailed options
- `dynamic(factory)`: Create dynamically based on initialize request

### Connectors

- `StdioConnector`: Spawns a subprocess and communicates via stdin/stdout
- `ChannelConnector`: In-memory channel for testing

### Logging

- `createLogger(options)`: Create a logger instance
- `createNoopLogger()`: Create a logger that discards all output
- `getLogger()`: Get the default logger
- `setLogger(logger)`: Set the default logger

## License

See repository root for license information.

# Installation Guide

Thinkwell offers multiple installation methods to fit your workflow. Choose the approach that works best for you.

## Quick Start

Try thinkwell without installing anything:

```bash
npx thinkwell init my-project
cd my-project
```

## Installation Methods

### Homebrew (Recommended for macOS/Linux)

The simplest way to install thinkwell system-wide:

```bash
brew install dherman/thinkwell/thinkwell
```

This installs a self-contained binary with everything included—no additional dependencies required.

### Manual Installation (macOS/Linux)

Download and install the binary directly:

**macOS Apple Silicon:**
```bash
mkdir -p ~/.local/bin && curl -L https://github.com/dherman/thinkwell/releases/latest/download/thinkwell-darwin-arm64.tar.gz | tar -xz -C ~/.local/bin && mv ~/.local/bin/thinkwell* ~/.local/bin/thinkwell
```

**macOS Intel:**
```bash
mkdir -p ~/.local/bin && curl -L https://github.com/dherman/thinkwell/releases/latest/download/thinkwell-darwin-x64.tar.gz | tar -xz -C ~/.local/bin && mv ~/.local/bin/thinkwell* ~/.local/bin/thinkwell
```

**Linux x64:**
```bash
mkdir -p ~/.local/bin && curl -L https://github.com/dherman/thinkwell/releases/latest/download/thinkwell-linux-x64.tar.gz | tar -xz -C ~/.local/bin && mv ~/.local/bin/thinkwell* ~/.local/bin/thinkwell
```

**Linux ARM64:**
```bash
mkdir -p ~/.local/bin && curl -L https://github.com/dherman/thinkwell/releases/latest/download/thinkwell-linux-arm64.tar.gz | tar -xz -C ~/.local/bin && mv ~/.local/bin/thinkwell* ~/.local/bin/thinkwell
```

Then add `~/.local/bin` to your PATH if not already present.

### Project Installation

For development, install thinkwell as a dev dependency in your project:

<!-- tabs:start -->
#### **npm**
```bash
npm install -D thinkwell
```

#### **pnpm**
```bash
pnpm add -D thinkwell
```

#### **yarn**
```bash
yarn add -D thinkwell
```

#### **bun**
```bash
bun add -D thinkwell
```
<!-- tabs:end -->

> **Note:** When installed via npm/pnpm/yarn/bun, thinkwell requires Node.js 24+. See [Runtime Requirements](#runtime-requirements) below.

### Global npm Installation

```bash
npm install -g thinkwell
```

## Runtime Requirements

Thinkwell uses a two-tier distribution model:

| Installation Method | Runtime Required | Notes |
|---------------------|------------------|-------|
| **Homebrew / Binary** | None | Self-contained binary with embedded Node.js runtime |
| **npm/pnpm/yarn/bun** | Node.js 24+ | Lightweight package, requires Node.js 24 or later |

### Why Node.js 24?

Thinkwell uses Node.js 24 with experimental TypeScript support to provide:

- **Native TypeScript execution** — No transpilation step, just write and run
- **Automatic schema generation** — `@JSONSchema` types become runtime validators
- **Standard Node.js runtime** — Uses the stable, well-tested Node.js ecosystem
- **External package resolution** — User scripts can import from their own `node_modules`

### Installing Node.js 24

If you installed thinkwell via npm and need Node.js 24:

```bash
# Using nvm (recommended)
nvm install 24
nvm use 24

# Using Homebrew
brew install node@24

# Using fnm
fnm install 24
fnm use 24
```

### Commands and Node.js Requirements

All thinkwell commands require Node.js 24+ when using the npm distribution:

| Command | Description |
|---------|-------------|
| `thinkwell --help` | Show help |
| `thinkwell --version` | Show version |
| `thinkwell init` | Initialize a new project |
| `thinkwell run <script>` | Run a TypeScript script |
| `thinkwell types` | Generate type declarations |

## CI/CD Installation

### Option 1: Direct Binary Download (Recommended)

The simplest approach—download a self-contained binary with no dependencies:

```yaml
# GitHub Actions
- name: Install thinkwell
  run: |
    curl -fsSL https://github.com/dherman/thinkwell/releases/latest/download/thinkwell-linux-x64.tar.gz | tar xz
    sudo mv thinkwell /usr/local/bin/

- name: Run agent
  run: thinkwell run src/agent.ts
```

Available binaries:
- `thinkwell-darwin-arm64.tar.gz` — macOS Apple Silicon
- `thinkwell-darwin-x64.tar.gz` — macOS Intel
- `thinkwell-linux-arm64.tar.gz` — Linux ARM64
- `thinkwell-linux-x64.tar.gz` — Linux x64

### Option 2: npm + Node.js 24 Setup

Smaller download, but requires Node.js 24:

```yaml
# GitHub Actions
- name: Setup Node.js 24
  uses: actions/setup-node@v4
  with:
    node-version: '24'

- name: Install thinkwell
  run: npm install -g thinkwell

- name: Run agent
  run: thinkwell run src/agent.ts
```

### Docker

For containerized workflows:

```dockerfile
# Using the binary (no runtime dependencies)
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://github.com/dherman/thinkwell/releases/latest/download/thinkwell-linux-x64.tar.gz | tar xz -C /usr/local/bin && \
    apt-get remove -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY src/ /app/src/
WORKDIR /app
CMD ["thinkwell", "run", "src/agent.ts"]
```

## Troubleshooting

### "Node.js 24 or later is required"

This error appears when using the npm distribution with an older Node.js version. Solutions:

1. **Upgrade Node.js:** Use nvm, fnm, or Homebrew to install Node.js 24+
2. **Use Homebrew binary instead:** `brew install dherman/thinkwell/thinkwell` (includes everything)

### "command not found: thinkwell"

After installing via npm, ensure your npm bin directory is in your PATH:

```bash
# Check where npm installs binaries
npm bin -g

# Add to PATH (add to your shell profile)
export PATH="$(npm bin -g):$PATH"
```

### Homebrew Formula Not Found

If `brew install dherman/thinkwell/thinkwell` fails:

```bash
# Tap the repository first
brew tap dherman/thinkwell

# Then install
brew install thinkwell
```

### Permission Denied on Linux

If the binary doesn't execute:

```bash
chmod +x thinkwell
```

### TypeScript Errors in IDE

If your IDE shows errors for `.Schema` properties:

1. Generate declaration files:
   ```bash
   thinkwell types
   ```

2. Ensure your `tsconfig.json` includes them:
   ```json
   {
     "include": ["src/**/*.ts", "src/**/*.thinkwell.d.ts"]
   }
   ```

3. Restart your TypeScript language server

### Schema Generation Not Working

The `@JSONSchema` decorator requires the thinkwell runtime. Ensure you're running your script with:

```bash
thinkwell run script.ts
```

Not with `node` directly.

## Script Limitations

### Top-Level Await Not Supported

Thinkwell uses Node.js's `require(esm)` feature to load user scripts, which does not support top-level `await`. If your script uses top-level await:

```typescript
// ❌ This will NOT work
const data = await fetchData();
```

Wrap your code in an async function:

```typescript
// ✅ This works
async function main() {
  const data = await fetchData();
}
main();
```

This affects less than 0.02% of npm packages. If you have dependencies that use top-level await, pre-bundle your script with esbuild.

### TypeScript Features

Thinkwell uses Node.js 24's `--experimental-transform-types` flag for full TypeScript support. All standard TypeScript features are supported:

**Fully Supported:**
- Type annotations, interfaces, type aliases
- Generic functions and classes
- Type-only imports (`import type {...}`, inline `type` specifier)
- Type assertions (`as` keyword)
- Enums (regular and const)
- Namespaces (used by @JSONSchema)
- Parameter properties (`constructor(public x: number)`)

**Not Supported:**
- JSX in `.ts` files (use `.tsx` extension)
- Legacy decorators (use standard decorators instead)

## Version Management

### Checking Installed Version

```bash
thinkwell --version
```

### Upgrading

**Homebrew:**
```bash
brew upgrade thinkwell
```

**npm:**
```bash
npm update -g thinkwell
```

**Project dependency:**
```bash
npm update thinkwell
```

## Next Steps

- [Quick Start Guide](../README.md#quick-start) — Write your first agent
- [IDE Support](../README.md#ide-support) — Set up autocomplete for schemas
- [CLI Reference](cli-reference.md) — Full command documentation

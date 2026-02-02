# Homebrew Tap for Thinkwell

This directory contains the Homebrew formula for installing thinkwell.

## Installation

```bash
brew tap dherman/thinkwell https://github.com/dherman/thinkwell
brew install thinkwell
```

Or install directly:

```bash
brew install dherman/thinkwell/thinkwell
```

## Requirements

The formula depends on Node.js (installed automatically by Homebrew).

To run thinkwell scripts, you'll also need [Bun](https://bun.sh):

```bash
brew install oven-sh/bun/bun
```

## Updating the Formula

When publishing a new version to npm:

1. Get the SHA256 of the new tarball:
   ```bash
   curl -s "https://registry.npmjs.org/thinkwell/-/thinkwell-X.X.X.tgz" | shasum -a 256
   ```

2. Update `Formula/thinkwell.rb` with the new version and SHA256

3. Test locally:
   ```bash
   brew install --build-from-source ./homebrew/Formula/thinkwell.rb
   ```

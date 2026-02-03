/**
 * Build command for creating self-contained executables from user scripts.
 *
 * This module provides the `thinkwell build` command that compiles user scripts
 * into standalone binaries using the same pkg-based tooling as the thinkwell CLI.
 *
 * The build process follows a two-stage pipeline:
 * 1. **Pre-bundle with esbuild** - Bundle user script + thinkwell packages into CJS
 * 2. **Compile with pkg** - Create self-contained binary with Node.js runtime
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve, basename, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Supported build targets
export type Target = "darwin-arm64" | "darwin-x64" | "linux-x64" | "linux-arm64" | "host";

// Map user-friendly target names to pkg target names
const TARGET_MAP: Record<Exclude<Target, "host">, string> = {
  "darwin-arm64": "node24-macos-arm64",
  "darwin-x64": "node24-macos-x64",
  "linux-x64": "node24-linux-x64",
  "linux-arm64": "node24-linux-arm64",
};

// Detect the current host platform
function detectHostTarget(): Exclude<Target, "host"> {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "linux" && arch === "x64") return "linux-x64";
  if (platform === "linux" && arch === "arm64") return "linux-arm64";

  throw new Error(
    `Unsupported platform: ${platform}-${arch}. ` +
    `Supported platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64`
  );
}

export interface BuildOptions {
  /** Entry point TypeScript/JavaScript file */
  entry: string;
  /** Output file path (default: ./<entry-basename>-<target>) */
  output?: string;
  /** Target platforms (default: ["host"]) */
  targets?: Target[];
  /** Additional files to embed as assets */
  include?: string[];
  /** Show detailed build output */
  verbose?: boolean;
}

interface BuildContext {
  /** Absolute path to the entry file */
  entryPath: string;
  /** Base name of the entry file (without extension) */
  entryBasename: string;
  /** Directory containing the entry file */
  entryDir: string;
  /** Temporary build directory */
  buildDir: string;
  /** Path to bundled thinkwell packages (dist-pkg from thinkwell package) */
  thinkwellDistPkg: string;
  /** Resolved targets (no "host") */
  resolvedTargets: Exclude<Target, "host">[];
  /** Build options */
  options: BuildOptions;
}

/**
 * Parse and validate build options from command-line arguments.
 */
export function parseBuildArgs(args: string[]): BuildOptions {
  const options: BuildOptions = {
    entry: "",
    targets: [],
    include: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "-o" || arg === "--output") {
      i++;
      if (i >= args.length) {
        throw new Error("Missing value for --output");
      }
      options.output = args[i];
    } else if (arg === "-t" || arg === "--target") {
      i++;
      if (i >= args.length) {
        throw new Error("Missing value for --target");
      }
      const target = args[i] as Target;
      const validTargets: Target[] = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "host"];
      if (!validTargets.includes(target)) {
        throw new Error(
          `Invalid target '${target}'. Valid targets: ${validTargets.join(", ")}`
        );
      }
      options.targets!.push(target);
    } else if (arg === "--include") {
      i++;
      if (i >= args.length) {
        throw new Error("Missing value for --include");
      }
      options.include!.push(args[i]);
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      // Positional argument - entry file
      if (options.entry) {
        throw new Error(`Unexpected argument: ${arg}`);
      }
      options.entry = arg;
    }
    i++;
  }

  // Validate entry
  if (!options.entry) {
    throw new Error("No entry file specified");
  }

  // Default target is host
  if (options.targets!.length === 0) {
    options.targets = ["host"];
  }

  return options;
}

/**
 * Initialize the build context with resolved paths and validated inputs.
 */
function initBuildContext(options: BuildOptions): BuildContext {
  // Resolve entry path
  const entryPath = isAbsolute(options.entry)
    ? options.entry
    : resolve(process.cwd(), options.entry);

  if (!existsSync(entryPath)) {
    throw new Error(`Entry file not found: ${options.entry}`);
  }

  const entryBasename = basename(entryPath).replace(/\.(ts|js|mts|mjs|cts|cjs)$/, "");
  const entryDir = dirname(entryPath);

  // Create build directory in the entry file's directory
  const buildDir = join(entryDir, ".thinkwell-build");

  // Find the thinkwell dist-pkg directory
  // When running from npm install: node_modules/thinkwell/dist-pkg
  // When running from source: packages/thinkwell/dist-pkg
  const thinkwellDistPkg = resolve(__dirname, "../../dist-pkg");
  if (!existsSync(thinkwellDistPkg)) {
    throw new Error(
      `Thinkwell dist-pkg not found at ${thinkwellDistPkg}. ` +
      `This may indicate a corrupted installation.`
    );
  }

  // Resolve "host" targets to actual platform
  const resolvedTargets = options.targets!.map((t) =>
    t === "host" ? detectHostTarget() : t
  );

  // Deduplicate targets
  const uniqueTargets = [...new Set(resolvedTargets)];

  return {
    entryPath,
    entryBasename,
    entryDir,
    buildDir,
    thinkwellDistPkg,
    resolvedTargets: uniqueTargets,
    options,
  };
}

/**
 * Generate the output path for a given target.
 */
function getOutputPath(ctx: BuildContext, target: Exclude<Target, "host">): string {
  if (ctx.options.output) {
    if (ctx.resolvedTargets.length === 1) {
      // Single target: use exact output path
      return isAbsolute(ctx.options.output)
        ? ctx.options.output
        : resolve(process.cwd(), ctx.options.output);
    } else {
      // Multiple targets: append target suffix
      const base = isAbsolute(ctx.options.output)
        ? ctx.options.output
        : resolve(process.cwd(), ctx.options.output);
      return `${base}-${target}`;
    }
  } else {
    // Default: <entry-basename>-<target> in current directory
    return resolve(process.cwd(), `${ctx.entryBasename}-${target}`);
  }
}

/**
 * Generate the wrapper entry point that sets up global.__bundled__.
 *
 * This creates a CJS file that:
 * 1. Loads the pre-bundled thinkwell packages
 * 2. Registers them in global.__bundled__
 * 3. Loads and runs the user's bundled code
 */
function generateWrapperSource(userBundlePath: string): string {
  return `#!/usr/bin/env node
/**
 * Generated wrapper for thinkwell build.
 * This file is auto-generated - do not edit.
 */

// Register bundled thinkwell packages
const thinkwell = require('./thinkwell.cjs');
const acpModule = require('./acp.cjs');
const protocolModule = require('./protocol.cjs');

global.__bundled__ = {
  'thinkwell': thinkwell,
  '@thinkwell/acp': acpModule,
  '@thinkwell/protocol': protocolModule,
};

// Load the user's bundled code
require('./${basename(userBundlePath)}');
`;
}

/**
 * Stage 1: Bundle user script with esbuild.
 *
 * This bundles the user's entry point along with all its dependencies
 * into a single CJS file. The thinkwell packages are marked as external
 * since they'll be provided via global.__bundled__.
 */
async function bundleUserScript(ctx: BuildContext): Promise<string> {
  const outputFile = join(ctx.buildDir, `${ctx.entryBasename}-bundle.cjs`);

  if (ctx.options.verbose) {
    console.log(`  Bundling ${ctx.entryPath}...`);
  }

  await esbuild({
    entryPoints: [ctx.entryPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: outputFile,
    // External: Node built-ins
    external: ["node:*"],
    // Mark thinkwell packages as external - they're provided via global.__bundled__
    // But actually, we need to transform the imports, so let's bundle them
    // and use a banner to set up the module aliases
    banner: {
      js: `
// Alias thinkwell packages to global.__bundled__
const __origRequire = require;
require = function(id) {
  if (id === 'thinkwell' || id === 'thinkwell:agent' || id === 'thinkwell:connectors') {
    return global.__bundled__['thinkwell'];
  }
  if (id === '@thinkwell/acp' || id === 'thinkwell:acp') {
    return global.__bundled__['@thinkwell/acp'];
  }
  if (id === '@thinkwell/protocol' || id === 'thinkwell:protocol') {
    return global.__bundled__['@thinkwell/protocol'];
  }
  return __origRequire(id);
};
require.resolve = __origRequire.resolve;
require.cache = __origRequire.cache;
require.extensions = __origRequire.extensions;
require.main = __origRequire.main;
`,
    },
    // Resolve thinkwell imports to bundled versions during bundle time
    plugins: [
      {
        name: "thinkwell-resolver",
        setup(build) {
          // Resolve thinkwell:* imports to the npm package
          build.onResolve({ filter: /^thinkwell:/ }, (args) => {
            const moduleName = args.path.replace("thinkwell:", "");
            const moduleMap: Record<string, string> = {
              agent: "thinkwell",
              acp: "@thinkwell/acp",
              protocol: "@thinkwell/protocol",
              connectors: "thinkwell",
            };
            const resolved = moduleMap[moduleName];
            if (resolved) {
              // Mark as external - will be provided by global.__bundled__ at runtime
              return { path: resolved, external: true };
            }
            return null;
          });

          // Mark thinkwell packages as external
          build.onResolve({ filter: /^(thinkwell|@thinkwell\/(acp|protocol))$/ }, (args) => {
            return { path: args.path, external: true };
          });
        },
      },
    ],
    sourcemap: false,
    minify: false,
    keepNames: true,
    target: "node24",
    logLevel: ctx.options.verbose ? "info" : "silent",
  });

  return outputFile;
}

/**
 * Copy thinkwell pre-bundled packages to build directory.
 */
function copyThinkwellBundles(ctx: BuildContext): void {
  const bundles = ["thinkwell.cjs", "acp.cjs", "protocol.cjs"];

  for (const bundle of bundles) {
    const src = join(ctx.thinkwellDistPkg, bundle);
    const dest = join(ctx.buildDir, bundle);

    if (!existsSync(src)) {
      throw new Error(`Thinkwell bundle not found: ${src}`);
    }

    const content = readFileSync(src);
    writeFileSync(dest, content);

    if (ctx.options.verbose) {
      console.log(`  Copied ${bundle}`);
    }
  }
}

/**
 * Stage 2: Compile with pkg.
 *
 * Uses @yao-pkg/pkg to create a self-contained binary.
 */
async function compileWithPkg(
  ctx: BuildContext,
  wrapperPath: string,
  target: Exclude<Target, "host">,
  outputPath: string
): Promise<void> {
  // Dynamic import of pkg
  const { exec } = await import("@yao-pkg/pkg");

  const pkgTarget = TARGET_MAP[target];

  if (ctx.options.verbose) {
    console.log(`  Compiling for ${target}...`);
  }

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Build pkg configuration
  const pkgConfig = [
    wrapperPath,
    "--targets",
    pkgTarget,
    "--output",
    outputPath,
    "--options",
    "experimental-transform-types,disable-warning=ExperimentalWarning",
    "--public", // Include source instead of bytecode (required for cross-compilation)
  ];

  // Add assets if specified
  if (ctx.options.include && ctx.options.include.length > 0) {
    for (const pattern of ctx.options.include) {
      pkgConfig.push("--assets", pattern);
    }
  }

  await exec(pkgConfig);
}

/**
 * Main build function.
 */
export async function runBuild(options: BuildOptions): Promise<void> {
  const ctx = initBuildContext(options);

  console.log(`Building ${ctx.entryBasename}...\n`);

  // Create build directory
  if (existsSync(ctx.buildDir)) {
    rmSync(ctx.buildDir, { recursive: true });
  }
  mkdirSync(ctx.buildDir, { recursive: true });

  try {
    // Stage 1: Bundle user script
    console.log("Stage 1: Bundling with esbuild");
    const userBundlePath = await bundleUserScript(ctx);
    console.log("  ✓ User script bundled\n");

    // Copy thinkwell bundles
    console.log("Stage 2: Preparing thinkwell packages");
    copyThinkwellBundles(ctx);
    console.log("  ✓ Thinkwell packages ready\n");

    // Generate wrapper
    const wrapperPath = join(ctx.buildDir, "wrapper.cjs");
    const wrapperSource = generateWrapperSource(userBundlePath);
    writeFileSync(wrapperPath, wrapperSource);

    if (ctx.options.verbose) {
      console.log("  ✓ Generated wrapper entry point\n");
    }

    // Stage 2: Compile with pkg for each target
    console.log("Stage 3: Compiling with pkg");
    const outputs: string[] = [];

    for (const target of ctx.resolvedTargets) {
      const outputPath = getOutputPath(ctx, target);
      await compileWithPkg(ctx, wrapperPath, target, outputPath);
      outputs.push(outputPath);
      console.log(`  ✓ ${basename(outputPath)}`);
    }

    console.log("\nBuild complete!");
    console.log("\nOutput:");
    for (const output of outputs) {
      console.log(`  ${output}`);
    }
  } finally {
    // Clean up build directory
    if (!ctx.options.verbose) {
      try {
        rmSync(ctx.buildDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    } else {
      console.log(`\nBuild artifacts preserved in: ${ctx.buildDir}`);
    }
  }
}

/**
 * Show help for the build command.
 */
export function showBuildHelp(): void {
  console.log(`
thinkwell build - Compile TypeScript scripts into standalone executables

Usage:
  thinkwell build [options] <entry>

Arguments:
  entry                  TypeScript or JavaScript entry point

Options:
  -o, --output <path>    Output file path (default: ./<name>-<target>)
  -t, --target <target>  Target platform (can be specified multiple times)
  --include <glob>       Additional files to embed as assets
  --verbose              Show detailed build output
  -h, --help             Show this help message

Targets:
  host                   Current platform (default)
  darwin-arm64           macOS on Apple Silicon
  darwin-x64             macOS on Intel
  linux-x64              Linux on x64
  linux-arm64            Linux on ARM64

Examples:
  thinkwell build src/agent.ts                     Build for current platform
  thinkwell build src/agent.ts -o dist/my-agent    Specify output path
  thinkwell build src/agent.ts --target linux-x64  Build for Linux
  thinkwell build src/agent.ts -t darwin-arm64 -t linux-x64  Multi-platform

The resulting binary is self-contained and includes:
  - Node.js 24 runtime with TypeScript support
  - All thinkwell packages
  - Your bundled application code

Note: Binaries are ~70-90 MB due to the embedded Node.js runtime.
`);
}

/**
 * Unit tests for dependency checking.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  checkDependencies,
  hasPackageJson,
  type DependencyCheckResult,
} from "./dependency-check.js";

// ============================================================================
// Helpers
// ============================================================================

function createTmpDir(prefix: string): string {
  const dir = join(tmpdir(), `thinkwell-dep-test-${prefix}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// hasPackageJson
// ============================================================================

describe("hasPackageJson", () => {
  describe("with package.json", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("has-pkg");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
    });

    after(() => cleanup(dir));

    it("should return true when package.json exists", () => {
      assert.strictEqual(hasPackageJson(dir), true);
    });
  });

  describe("without package.json", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("no-pkg");
    });

    after(() => cleanup(dir));

    it("should return false when package.json does not exist", () => {
      assert.strictEqual(hasPackageJson(dir), false);
    });
  });
});

// ============================================================================
// checkDependencies - Fast Path (package.json inspection)
// ============================================================================

describe("checkDependencies", () => {
  describe("fast path - dependencies field", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("fast-deps");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          dependencies: {
            thinkwell: "^0.5.0",
          },
          devDependencies: {
            typescript: "^5.7.0",
          },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should find thinkwell in dependencies", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, true);
      assert.strictEqual(result.thinkwell.version, "^0.5.0");
      assert.strictEqual(result.thinkwell.source, "package.json");
    });

    it("should find typescript in devDependencies", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.typescript.found, true);
      assert.strictEqual(result.typescript.version, "^5.7.0");
      assert.strictEqual(result.typescript.source, "package.json");
    });
  });

  describe("fast path - devDependencies only", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("fast-dev-deps");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          devDependencies: {
            thinkwell: "^0.4.0",
            typescript: "^5.6.0",
          },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should find both deps in devDependencies", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, true);
      assert.strictEqual(result.thinkwell.version, "^0.4.0");
      assert.strictEqual(result.typescript.found, true);
      assert.strictEqual(result.typescript.version, "^5.6.0");
    });
  });

  describe("fast path - peerDependencies", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("fast-peer-deps");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          peerDependencies: {
            thinkwell: ">=0.4.0",
            typescript: ">=5.0.0",
          },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should find deps in peerDependencies", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, true);
      assert.strictEqual(result.thinkwell.version, ">=0.4.0");
      assert.strictEqual(result.typescript.found, true);
      assert.strictEqual(result.typescript.version, ">=5.0.0");
    });
  });

  describe("fast path - optionalDependencies", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("fast-opt-deps");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          optionalDependencies: {
            thinkwell: "^0.5.0",
          },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should find deps in optionalDependencies", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, true);
      assert.strictEqual(result.thinkwell.version, "^0.5.0");
      assert.strictEqual(result.thinkwell.source, "package.json");
    });
  });

  describe("fast path - missing dependencies", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("fast-missing");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          dependencies: {
            lodash: "^4.0.0",
          },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should report dependencies as not found", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, false);
      assert.strictEqual(result.typescript.found, false);
    });
  });

  describe("fast path - partial dependencies", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("fast-partial");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          dependencies: {
            thinkwell: "^0.5.0",
          },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should find thinkwell but not typescript", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, true);
      assert.strictEqual(result.typescript.found, false);
    });
  });

  describe("package manager detection", () => {
    describe("with pnpm lockfile", () => {
      let dir: string;

      before(() => {
        dir = createTmpDir("pm-pnpm");
        writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: 9\n");
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({
            name: "test-project",
            dependencies: { thinkwell: "^0.5.0" },
            devDependencies: { typescript: "^5.7.0" },
          }),
        );
      });

      after(() => cleanup(dir));

      it("should detect pnpm as package manager", async () => {
        const result = await checkDependencies(dir);
        assert.strictEqual(result.packageManager.name, "pnpm");
      });
    });

    describe("with yarn lockfile", () => {
      let dir: string;

      before(() => {
        dir = createTmpDir("pm-yarn");
        writeFileSync(join(dir, "yarn.lock"), "# yarn lockfile v1\n");
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({
            name: "test-project",
            dependencies: { thinkwell: "^0.5.0" },
            devDependencies: { typescript: "^5.7.0" },
          }),
        );
      });

      after(() => cleanup(dir));

      it("should detect yarn as package manager", async () => {
        const result = await checkDependencies(dir);
        assert.strictEqual(result.packageManager.name, "yarn");
      });
    });

    describe("with npm lockfile", () => {
      let dir: string;

      before(() => {
        dir = createTmpDir("pm-npm");
        writeFileSync(
          join(dir, "package-lock.json"),
          JSON.stringify({ lockfileVersion: 3 }),
        );
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({
            name: "test-project",
            dependencies: { thinkwell: "^0.5.0" },
            devDependencies: { typescript: "^5.7.0" },
          }),
        );
      });

      after(() => cleanup(dir));

      it("should detect npm as package manager", async () => {
        const result = await checkDependencies(dir);
        assert.strictEqual(result.packageManager.name, "npm");
      });
    });
  });

  describe("empty package.json", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("empty-pkg");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test-project" }),
      );
    });

    after(() => cleanup(dir));

    it("should report both dependencies as not found", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, false);
      assert.strictEqual(result.typescript.found, false);
    });

    it("should default to npm", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.packageManager.name, "npm");
    });
  });

  describe("no package.json", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("no-pkg-check");
    });

    after(() => cleanup(dir));

    it("should report both dependencies as not found", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, false);
      assert.strictEqual(result.typescript.found, false);
    });
  });

  describe("invalid package.json", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("invalid-pkg");
      writeFileSync(join(dir, "package.json"), "{ invalid json }");
    });

    after(() => cleanup(dir));

    it("should handle invalid JSON gracefully", async () => {
      const result = await checkDependencies(dir);
      assert.strictEqual(result.thinkwell.found, false);
      assert.strictEqual(result.typescript.found, false);
    });
  });
});

// ============================================================================
// Package Manager CLI Parsing (unit tests for parsers)
// Note: Full integration tests with actual package manager commands
// would require setting up real workspaces, which is done in integration tests.
// ============================================================================

describe("Package manager output parsing", () => {
  // These tests verify the parsing logic by importing the module
  // and checking that the result types are correct.
  // The actual parsing functions are internal, so we test them
  // through the checkDependencies function behavior.

  describe("result structure", () => {
    let dir: string;

    before(() => {
      dir = createTmpDir("result-structure");
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: { thinkwell: "1.0.0" },
          devDependencies: { typescript: "5.0.0" },
        }),
      );
    });

    after(() => cleanup(dir));

    it("should return proper result structure", async () => {
      const result = await checkDependencies(dir);

      // Verify structure
      assert.ok("thinkwell" in result);
      assert.ok("typescript" in result);
      assert.ok("packageManager" in result);

      // Verify thinkwell status structure
      assert.ok("found" in result.thinkwell);
      assert.ok(typeof result.thinkwell.found === "boolean");

      // Verify typescript status structure
      assert.ok("found" in result.typescript);
      assert.ok(typeof result.typescript.found === "boolean");

      // Verify package manager info structure
      assert.ok("name" in result.packageManager);
      assert.ok("lockfile" in result.packageManager);
      assert.ok("addCommand" in result.packageManager);
      assert.ok("whyCommand" in result.packageManager);
    });
  });
});

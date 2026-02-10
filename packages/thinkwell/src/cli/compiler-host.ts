/**
 * Custom TypeScript CompilerHost for thinkwell build and check commands.
 *
 * This module provides the shared infrastructure that intercepts TypeScript's
 * file reads and applies @JSONSchema namespace injection in memory. Files
 * without @JSONSchema markers pass through unchanged. Files from node_modules
 * and TypeScript lib files are always passed through unchanged.
 *
 * Used by both `thinkwell build` (with emit) and `thinkwell check` (noEmit).
 */

import ts from "typescript";
import { resolve, dirname } from "node:path";
import { transformJsonSchemas, hasJsonSchemaMarkers } from "./schema.js";

/**
 * Result of parsing and validating a tsconfig.json file.
 */
export interface ParsedConfig {
  /** Resolved compiler options */
  options: ts.CompilerOptions;
  /** Root file names (the files to compile) */
  fileNames: string[];
  /** Any errors encountered during parsing */
  errors: readonly ts.Diagnostic[];
}

/**
 * Read and parse a tsconfig.json file using the TypeScript compiler API.
 *
 * @param configPath - Absolute path to tsconfig.json
 * @returns Parsed configuration, or an error diagnostic if the file can't be read
 */
export function parseTsConfig(configPath: string): ParsedConfig {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    return {
      options: {},
      fileNames: [],
      errors: [configFile.error],
    };
  }

  const configDir = dirname(configPath);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    configDir,
    /* existingOptions */ undefined,
    configPath,
  );

  return {
    options: parsed.options,
    fileNames: parsed.fileNames,
    errors: parsed.errors,
  };
}

/**
 * Determine whether a file path should receive @JSONSchema transformation.
 *
 * Only project source files are transformed. Files in node_modules and
 * TypeScript's own lib files are always passed through unchanged.
 */
function shouldTransform(fileName: string): boolean {
  if (fileName.includes("node_modules")) return false;
  if (fileName.includes("/lib/lib.")) return false;
  return true;
}

/**
 * Create a custom CompilerHost that applies @JSONSchema transformation.
 *
 * The host wraps the default TypeScript CompilerHost and intercepts
 * `getSourceFile()` to apply `transformJsonSchemas()` on project files.
 * All other methods delegate to the default host.
 *
 * @param options - TypeScript compiler options (used to create the default host)
 * @returns A CompilerHost that applies @JSONSchema transformations in memory
 */
export function createThinkwellHost(options: ts.CompilerOptions): ts.CompilerHost {
  const defaultHost = ts.createCompilerHost(options);

  return {
    ...defaultHost,

    getSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) {
      const source = ts.sys.readFile(fileName);
      if (source === undefined) {
        return undefined;
      }

      // Only transform project source files that contain @JSONSchema markers
      if (shouldTransform(fileName) && hasJsonSchemaMarkers(source)) {
        const transformed = transformJsonSchemas(fileName, source);
        return ts.createSourceFile(fileName, transformed, languageVersionOrOptions);
      }

      // Pass through unchanged
      return ts.createSourceFile(fileName, source, languageVersionOrOptions);
    },
  };
}

/**
 * Create a TypeScript Program wired to the custom CompilerHost.
 *
 * This is the main entry point for both `thinkwell build` and `thinkwell check`.
 * The returned program can be used with `ts.getPreEmitDiagnostics()` for type
 * checking or `program.emit()` for producing output files.
 *
 * @param configPath - Absolute path to the project's tsconfig.json
 * @returns The ts.Program and any config-level diagnostics, or null with errors
 */
export function createThinkwellProgram(configPath: string): {
  program: ts.Program;
  configErrors: readonly ts.Diagnostic[];
} {
  const resolvedConfigPath = resolve(configPath);
  const { options, fileNames, errors } = parseTsConfig(resolvedConfigPath);

  // If there are fatal config errors, still return them so callers can report
  if (errors.length > 0) {
    // Check if any errors are fatal (not just warnings)
    const fatalErrors = errors.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    );
    if (fatalErrors.length > 0) {
      // Create a minimal program so callers have a consistent interface
      const host = createThinkwellHost(options);
      const program = ts.createProgram([], options, host);
      return { program, configErrors: errors };
    }
  }

  const host = createThinkwellHost(options);
  const program = ts.createProgram(fileNames, options, host);

  return { program, configErrors: errors };
}

# packages/adapter-javascript/src/utils/config-transformer.ts
@source-hash: d2eeaf3f0a1fb31a
@generated: 2026-02-09T18:13:56Z

## Purpose & Responsibility
This utility module provides synchronous, no-throw helpers for transforming and detecting JavaScript/TypeScript project configuration. It's specifically designed for cheap filesystem checks to support launch configuration in JS debugging scenarios.

## Key Functions

### Core Configuration Helpers
- **`determineOutFiles`** (L28-33): Determines output file patterns for js-debug. Returns user-provided outFiles if non-empty, otherwise defaults to `['**/*.js', '!**/node_modules/**']`.
- **`transformConfig`** (L149-151): Back-compatibility placeholder that returns config unchanged. Kept for existing exports until migration to specific helpers.

### Project Type Detection  
- **`isESMProject`** (L56-113): Detects if a project should be treated as ESM using multiple heuristics:
  - File extension check: `.mjs` or `.mts` → ESM
  - `package.json` with `"type": "module"` in program directory or cwd
  - `tsconfig.json` with `compilerOptions.module` set to 'ESNext' or 'NodeNext'
- **`hasTsConfigPaths`** (L119-143): Detects if tsconfig.json contains non-empty `compilerOptions.paths` configuration.

### Utilities
- **`safeJsonParse`** (L38-44): Internal JSON parsing helper that returns undefined on parse errors.
- **`setDefaultFileSystem`** (L19-21): Allows injection of custom FileSystem implementation (primarily for testing).

## Dependencies & Architecture
- **External**: `path` (Node.js built-in), `@debugmcp/shared` (FileSystem interface)
- **FileSystem Abstraction**: Uses injectable `FileSystem` interface with `NodeFileSystem` as default (L13)
- **Type Definitions**: `PkgJson` (L46), `TsConfig` (L47) for configuration parsing

## Key Patterns
- **No-throw Design**: All functions catch and ignore filesystem errors, following defensive programming
- **Heuristic-based Detection**: Multiple fallback strategies for ESM detection
- **Directory Resolution**: Checks both program directory and current working directory for configuration files
- **Testable Design**: FileSystem injection allows for isolated testing without real filesystem access

## Critical Invariants
- Functions never throw exceptions (wrapped in try-catch blocks)
- Default patterns exclude `node_modules` to avoid performance issues
- ESM detection prioritizes explicit indicators (file extensions) over heuristics
- All filesystem operations use the injected FileSystem interface for consistency
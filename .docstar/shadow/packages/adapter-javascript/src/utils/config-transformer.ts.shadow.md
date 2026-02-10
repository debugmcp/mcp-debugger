# packages/adapter-javascript/src/utils/config-transformer.ts
@source-hash: 5e487989fb0be110
@generated: 2026-02-10T01:18:55Z

## Purpose
Configuration transformation utilities for JavaScript/TypeScript debugging in VS Code js-debug adapter. Provides synchronous, no-throw filesystem-based detection of project configuration characteristics.

## Key Components

### Core Exports
- `determineOutFiles(programPath, userOutFiles)` (L28-33): Returns user-provided outFiles or defaults to `['**/*.js', '!**/node_modules/**']`
- `isESMProject(programPath, cwd, fileSystem)` (L56-113): Detects ESM projects via file extensions (.mjs/.mts), package.json "type": "module", or tsconfig.json module settings
- `hasTsConfigPaths(cwdOrProgramDir, fileSystem)` (L119-143): Checks for non-empty compilerOptions.paths in tsconfig.json
- `transformConfig(config)` (L150-152): Identity transform (shallow copy) - actual logic delegated to helper functions
- `setDefaultFileSystem(fileSystem)` (L19-21): Test utility to inject filesystem implementation

### Internal Utilities
- `safeJsonParse<T>(text)` (L38-44): Safe JSON parsing with undefined fallback
- `defaultFileSystem` (L13): Global NodeFileSystem instance, overridable for testing

### Type Definitions
- `PkgJson` (L46): Minimal package.json shape with optional "type" field
- `TsConfig` (L47): Minimal tsconfig.json shape for module detection

## Dependencies
- `@debugmcp/shared`: FileSystem abstraction (NodeFileSystem)
- `path`: Node.js path utilities for directory/file resolution

## Architecture Patterns
- **No-throw design**: All functions catch and ignore filesystem errors, returning safe defaults
- **Dependency injection**: FileSystem parameter allows testing with mock implementations
- **Heuristic-based detection**: ESM detection uses multiple fallback strategies
- **Directory traversal**: Checks both program directory and cwd for configuration files

## Key Behaviors
- ESM detection precedence: file extension → package.json → tsconfig.json module setting
- Supports case-insensitive module name matching ("esnext", "nodenext")
- Always resolves paths to absolute before filesystem operations
- Falls back to process.cwd() when directory parameter is empty
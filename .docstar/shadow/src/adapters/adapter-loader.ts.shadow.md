# src/adapters/adapter-loader.ts
@source-hash: 7f59eb0326fd690a
@generated: 2026-02-11T16:12:53Z

## Purpose
Dynamic adapter loading system for debugMCP that discovers, loads, and manages debugger adapters for different programming languages at runtime.

## Core Classes & Interfaces

**ModuleLoader Interface (L7-9)**: Abstraction for module loading, enabling testability and dependency injection.
- `load(modulePath)`: Async module loading with flexible import strategies

**AdapterMetadata Interface (L11-16)**: Metadata structure for adapter discovery:
- `name`: Language identifier
- `packageName`: NPM package name
- `description`: Optional human-readable description
- `installed`: Runtime availability status

**AdapterLoader Class (L18-179)**: Main orchestrator for adapter lifecycle management
- `cache` (L19): In-memory factory cache to avoid repeated loading
- `logger` (L20): Winston logger instance for debugging and monitoring
- `moduleLoader` (L21): Pluggable module loading strategy

## Key Methods

**loadAdapter(language) (L42-120)**: Primary loading method with robust fallback strategy:
1. Cache lookup for previously loaded adapters
2. Package name resolution using naming convention
3. Progressive loading: package name → monorepo paths → createRequire fallback
4. Factory class instantiation with error handling
5. Cache storage and logging

**isAdapterAvailable(language) (L125-132)**: Non-throwing availability check that leverages loadAdapter

**listAvailableAdapters() (L137-161)**: Returns hardcoded known adapters with runtime availability detection

## Dependencies & Architecture

**External Dependencies**:
- `@debugmcp/shared.IAdapterFactory`: Core adapter interface
- `winston.Logger`: Structured logging
- Node.js `module.createRequire`: CJS compatibility fallback
- `url.fileURLToPath`: URL to filesystem path conversion

**Naming Conventions**:
- Package pattern: `@debugmcp/adapter-{language}` (L164)
- Factory class pattern: `{Language}AdapterFactory` (L175-178)
- Fallback paths: node_modules → packages directory structure (L168-173)

## Loading Strategy

**Multi-tier Resolution (L54-88)**:
1. Primary: Direct package import by name
2. Fallback 1: Relative node_modules path
3. Fallback 2: Monorepo packages path
4. Fallback 3: createRequire for CJS/bundled contexts

**Error Handling**: Distinguishes MODULE_NOT_FOUND (installation issue) from other errors (configuration/build issue) with specific user guidance (L104-119).

## Known Adapters
Supports mock, python, javascript, rust, and go debuggers with corresponding NPM packages (L138-144).
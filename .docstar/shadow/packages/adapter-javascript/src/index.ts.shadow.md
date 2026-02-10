# packages/adapter-javascript/src/index.ts
@source-hash: 758b5f8b713a0532
@generated: 2026-02-09T18:14:27Z

## Primary Purpose
Package entry point for `@debugmcp/adapter-javascript` that provides JavaScript/TypeScript debugging capabilities through MCP (Model Context Protocol). Serves as the main public API surface by re-exporting all essential components.

## Key Exports

### Factory
- `JavascriptAdapterFactory` (L6) - Primary factory for creating JavaScript debug adapter instances

### Adapter
- `JavascriptDebugAdapter` (L9) - Core debug adapter implementation handling JavaScript/TypeScript debugging sessions

### Utilities
- `resolveNodeExecutable` (L12) - Locates and resolves Node.js executable paths for debugging
- `detectTsRunners` (L13) - Identifies available TypeScript runtime environments (ts-node, tsx, etc.)
- `transformConfig` (L14) - Transforms debug configuration objects for runtime compatibility

### Types
- `JsDebugConfig` (L17) - TypeScript interface defining JavaScript debugging configuration structure

## Architecture
Classic barrel export pattern providing clean public API. Uses ES module syntax with explicit `.js` extensions for Node.js compatibility. Separates concerns into factory, adapter, utilities, and types.

## Dependencies
Internal modules only - no external dependencies in this entry point. All imports use relative paths with explicit file extensions.
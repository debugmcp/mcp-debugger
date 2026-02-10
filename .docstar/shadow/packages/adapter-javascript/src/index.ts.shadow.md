# packages/adapter-javascript/src/index.ts
@source-hash: 758b5f8b713a0532
@generated: 2026-02-10T00:41:18Z

## Purpose and Responsibility
Entry point module for the `@debugmcp/adapter-javascript` package that provides debugging capabilities for JavaScript/TypeScript applications. Serves as the public API surface by re-exporting core components, utilities, and types.

## Key Exports

### Core Components
- **JavascriptAdapterFactory** (L6): Factory class for creating JavaScript debug adapter instances
- **JavascriptDebugAdapter** (L9): Main debug adapter implementation for JavaScript/TypeScript debugging sessions

### Utilities
- **resolveNodeExecutable** (L12): Utility function for locating and resolving Node.js executable paths
- **detectTsRunners** (L13): Function to detect available TypeScript runtime environments (ts-node, tsx, etc.)
- **transformConfig** (L14): Configuration transformation utility for adapting debug configurations

### Types
- **JsDebugConfig** (L17): TypeScript type definition for JavaScript debug configuration objects

## Architecture Notes
- Pure re-export module following barrel pattern for clean public API
- Clear separation between factory, adapter implementation, utilities, and types
- Comment on L11 indicates utilities section is designed for extensibility with future debugging tasks
- All imports use explicit `.js` extensions for ES module compatibility

## Dependencies
Depends on four internal modules within the package:
- `./javascript-adapter-factory.js`
- `./javascript-debug-adapter.js` 
- `./utils/` directory modules
- `./types/js-debug-config.js`
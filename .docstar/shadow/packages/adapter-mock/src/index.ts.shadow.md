# packages/adapter-mock/src/index.ts
@source-hash: 47d9dc5479c0be21
@generated: 2026-02-09T18:14:30Z

## Primary Purpose
Index file serving as the main entry point for the mock adapter package, providing a clean public API by re-exporting key components from internal modules.

## Exported Components

### MockAdapterFactory (L1)
Factory class exported from `./mock-adapter-factory.js` - likely responsible for creating mock adapter instances with configurable behavior.

### MockDebugAdapter (L2) 
Main mock debug adapter implementation exported from `./mock-debug-adapter.js` - provides debugging functionality for testing scenarios.

### MockErrorScenario (L2)
Enum or class defining error scenarios for testing, enabling simulation of various failure conditions in debug adapters.

### MockAdapterConfig (L3)
Type definition for configuring mock adapter behavior - exported as a type-only export, suggesting it's a TypeScript interface or type alias used for type safety.

## Architecture Pattern
Follows standard barrel export pattern where the index file serves as the package's public API facade, hiding internal module structure from consumers while providing clean imports.

## Dependencies
- Internal modules: `mock-adapter-factory.js` and `mock-debug-adapter.js`
- Uses ES6 module syntax with `.js` extensions in import paths (TypeScript with Node16+ module resolution)

## Usage Context
This appears to be a testing utility package that provides mock implementations of debug adapters, allowing developers to simulate various debugging scenarios and error conditions in their tests without requiring actual debug targets.
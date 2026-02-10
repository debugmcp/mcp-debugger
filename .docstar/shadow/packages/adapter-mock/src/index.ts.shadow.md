# packages/adapter-mock/src/index.ts
@source-hash: 47d9dc5479c0be21
@generated: 2026-02-10T00:41:17Z

## Purpose
Entry point module for the mock adapter package, providing a clean public API for debug adapter testing and development tools.

## Exports
- **MockAdapterFactory** (L1): Factory class for creating mock debug adapter instances, imported from mock-adapter-factory module
- **MockDebugAdapter** (L2): Core mock debug adapter implementation for testing scenarios
- **MockErrorScenario** (L2): Enumeration or configuration type for simulating error conditions during debugging
- **MockAdapterConfig** (L3): Type definition for configuring mock adapter behavior and settings

## Architecture
Follows a barrel export pattern, centralizing imports from internal modules (`mock-adapter-factory.js` and `mock-debug-adapter.js`) to provide a unified interface. This design allows consumers to import all mock adapter functionality from a single entry point while maintaining internal module separation.

## Dependencies
- Internal: `./mock-adapter-factory.js` and `./mock-debug-adapter.js`
- No external dependencies visible in this entry module
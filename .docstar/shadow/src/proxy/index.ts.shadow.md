# src/proxy/index.ts
@source-hash: ef92c93ee016049a
@generated: 2026-02-09T18:15:01Z

## Purpose
Module barrel/index file that provides a clean public API for the proxy subsystem by re-exporting types and classes from internal modules.

## Exports
- **Type Exports (L1-4)**: `IProxyManager` and `ProxyManagerEvents` interfaces from `proxy-manager.js`
- **Type Export (L6)**: `ProxyConfig` type from `proxy-config.js` 
- **Class Export (L8)**: `ProxyManager` concrete implementation from `proxy-manager.js`

## Architecture
Classic barrel pattern that consolidates proxy-related functionality into a single entry point. Consumers import from this index rather than individual modules, providing:
- Clean separation between public API and internal structure
- Easier refactoring of internal module organization
- Consistent import paths for proxy functionality

## Dependencies
- `./proxy-manager.js` - Core proxy management implementation and types
- `./proxy-config.js` - Configuration type definitions

The module serves as the primary interface for proxy functionality, suggesting this is a key subsystem component in a larger application architecture.
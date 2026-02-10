# src/proxy/index.ts
@source-hash: ef92c93ee016049a
@generated: 2026-02-10T00:41:44Z

**Purpose**: Module entry point that re-exports proxy-related types and classes from separate implementation files.

**Architecture**: Pure barrel export pattern - aggregates and exposes public API without any local implementation.

**Exports**:
- **Type Exports (L1-6)**: 
  - `IProxyManager`, `ProxyManagerEvents` (L1-4): Interface and event types from proxy-manager module
  - `ProxyConfig` (L6): Configuration type from proxy-config module
- **Class Export (L8)**: 
  - `ProxyManager` (L8): Main proxy management implementation from proxy-manager module

**Dependencies**:
- `./proxy-manager.js`: Core proxy management functionality
- `./proxy-config.js`: Configuration type definitions

**Pattern**: Standard TypeScript barrel pattern for clean module boundaries and simplified imports. Separates type exports from implementation exports for better tree-shaking and dependency management.
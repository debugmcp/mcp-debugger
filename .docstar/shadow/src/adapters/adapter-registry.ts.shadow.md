# src/adapters/adapter-registry.ts
@source-hash: 227bfef794c0cf9b
@generated: 2026-02-09T18:15:05Z

**Purpose**: Central registry for managing debug adapter factories and instances with lifecycle management, dynamic loading, and event emission.

**Core Classes**:
- `AdapterRegistry` (L37-389): Main registry implementation extending EventEmitter, manages adapter factories and active instances
- Singleton pattern via `getAdapterRegistry()` (L399-403) and `resetAdapterRegistry()` (L409-415)

**Key Dependencies**:
- `@debugmcp/shared`: Core interfaces and error types (L7-18)
- `AdapterLoader` (L20-21): Handles dynamic adapter loading
- `createProductionDependencies` (L343): Runtime dependency injection

**Configuration**:
- `DEFAULT_CONFIG` (L26-32): Validation, override protection, instance limits, auto-disposal with 5min timeout
- Constructor supports dynamic loading via `enableDynamicLoading` flag or `MCP_CONTAINER` env var (L46-54)

**Core Operations**:
- `register()` (L59-76): Factory registration with validation and duplicate protection
- `unregister()` (L81-103): Factory removal with active adapter cleanup
- `create()` (L108-169): Adapter instantiation with dynamic loading fallback, instance limits, and lifecycle tracking
- `disposeAll()` (L296-324): Complete registry cleanup with error handling

**Language Support**:
- `getSupportedLanguages()` (L174-176): Returns registered languages
- `listLanguages()` (L225-254): Includes dynamically available adapters when enabled
- `listAvailableAdapters()` (L259-291): Detailed metadata with installation status

**Lifecycle Management**:
- Auto-disposal system (L361-380): Monitors adapter state changes, triggers disposal on disconnect/error
- Active instance tracking with Set-based collections (L38-39, L146-165)
- Dispose timers for cleanup scheduling (L41, L382-388)

**Event System**:
- Emits: `factoryRegistered`, `factoryUnregistered`, `adapterCreated`, `registryDisposed`, `error`
- Adapter state monitoring for auto-disposal decisions

**Architecture Patterns**:
- Factory pattern for adapter creation
- Observer pattern for lifecycle events  
- Singleton pattern for global registry access
- Graceful degradation when dynamic loading fails

**Critical Constraints**:
- Maximum instances per language configurable (default 10)
- Factory validation on registration (configurable)
- Backward compatibility preservation for unit tests via dynamic loading opt-in
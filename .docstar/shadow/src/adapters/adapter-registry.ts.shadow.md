# src/adapters/adapter-registry.ts
@source-hash: 0f58642e0abc96d7
@generated: 2026-02-10T01:19:06Z

**Purpose**: Central registry for managing debug adapter factories and active adapter instances. Provides lifecycle management including registration, creation, tracking, and disposal with configurable auto-dispose timeout and instance limits.

**Core Architecture**:
- `AdapterRegistry` class (L37-387) extends EventEmitter, implements `IAdapterRegistry`
- Singleton pattern via `getAdapterRegistry()` (L397-402) and `resetAdapterRegistry()` (L407-414)
- Maps for tracking: factories (L38), activeAdapters (L39), disposeTimers (L41)
- Optional dynamic adapter loading via `AdapterLoader` (L42)

**Configuration**:
- `DEFAULT_CONFIG` (L26-32): validateOnRegister=true, allowOverride=false, maxInstancesPerLanguage=10, autoDispose=true, autoDisposeTimeout=5min
- Dynamic loading enabled via `enableDynamicLoading` config or `MCP_CONTAINER` env var (L50-53)

**Key Methods**:

**Registration Management**:
- `register(language, factory)` (L59-76): Validates factory if configured, checks duplicates, emits 'factoryRegistered'
- `unregister(language)` (L81-103): Disposes all active adapters for language, cleans up timers, emits 'factoryUnregistered'

**Adapter Creation**:
- `create(language, config)` (L108-169): Core creation method with dynamic loading fallback, instance limit enforcement, auto-dispose setup
- `createDependencies(config)` (L340-354): Creates production dependencies with logger, fileSystem, environment, etc.

**Discovery & Metadata**:
- `getSupportedLanguages()` (L174-176): Returns registered factory keys
- `listLanguages()` (L225-254): Combines registered + dynamically available adapters
- `listAvailableAdapters()` (L259-291): Returns detailed metadata with install status
- `getAdapterInfo(language)` (L188-204): Factory metadata + active instance count
- `getAllAdapterInfo()` (L209-220): Map of all adapter info

**Lifecycle Management**:
- `setupAutoDispose(language, adapter)` (L359-378): Monitors state changes, sets dispose timer on disconnect/error
- `clearDisposeTimer(adapter)` (L380-386): Cancels pending dispose timers
- `disposeAll()` (L296-324): Cleanup all adapters, timers, and tracking maps
- `getActiveAdapterCount()` (L329-335): Total active instances across all languages

**Key Dependencies**:
- `@debugmcp/shared`: Core interfaces and error types
- `./adapter-loader.js`: Dynamic adapter loading capability
- `../container/dependencies.js`: Production dependency injection

**Events Emitted**:
- 'factoryRegistered', 'factoryUnregistered', 'adapterCreated', 'registryDisposed', 'error'

**Critical Behaviors**:
- Dynamic loading attempts on unknown languages when enabled (L111-126)
- Instance limit enforcement per language (L129-134) 
- Auto-dispose on disconnect/error states with configurable timeout (L363-377)
- Graceful error handling during disposal operations (L91-93, L303-306)
- Backward compatibility preservation for unit tests via dynamic loading opt-in (L43-54)
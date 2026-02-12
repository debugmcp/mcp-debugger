# src/adapters/
@generated: 2026-02-11T23:47:41Z

## Purpose
The adapters module provides the dynamic adapter management infrastructure for debugMCP, responsible for discovering, loading, registering, and lifecycle management of debug adapters for different programming languages. This module enables runtime adapter discovery and pluggable debugger support through a centralized registry system.

## Key Components and Relationships

**AdapterLoader** (`adapter-loader.ts`): Dynamic discovery and loading system that:
- Discovers available debug adapters using naming conventions (`@debugmcp/adapter-{language}`)
- Implements multi-tier loading strategy (direct package → node_modules → monorepo paths → createRequire fallback)
- Provides factory class instantiation with robust error handling
- Caches loaded adapters to avoid repeated loading overhead

**AdapterRegistry** (`adapter-registry.ts`): Central lifecycle management system that:
- Maintains registry of adapter factories and active instances
- Provides singleton access pattern for global state management
- Integrates with AdapterLoader for dynamic loading capabilities
- Manages adapter lifecycle including creation, tracking, and disposal

**Integration Flow**: Registry delegates unknown language requests to Loader, which discovers and loads adapter packages dynamically. Successfully loaded adapters are cached and managed by the Registry's lifecycle system.

## Public API Surface

**Primary Entry Points**:
- `getAdapterRegistry()`: Singleton access to the global adapter registry
- `AdapterRegistry.create(language, config)`: Create adapter instances for specific languages
- `AdapterRegistry.register(language, factory)`: Explicitly register adapter factories
- `AdapterRegistry.listAvailableAdapters()`: Discover all available adapters with metadata

**Discovery & Metadata APIs**:
- `getSupportedLanguages()`: Get registered language identifiers
- `getAdapterInfo(language)`: Get factory metadata and active instance counts
- `listLanguages()`: Combined view of registered and dynamically available adapters

**Lifecycle Management APIs**:
- `unregister(language)`: Remove adapter and dispose active instances  
- `disposeAll()`: Clean shutdown of all adapters and tracking state
- `setupAutoDispose()`: Configure automatic cleanup on adapter state changes

## Internal Organization and Data Flow

**Loading Strategy**:
1. Registry checks for pre-registered factories
2. If not found and dynamic loading enabled, delegates to AdapterLoader
3. Loader attempts progressive resolution: package name → fallback paths → createRequire
4. Successfully loaded factories are cached and registered automatically
5. Registry creates adapter instances with dependency injection and tracking

**State Management**:
- Factory registry: Map of language → IAdapterFactory
- Active adapters: Map of adapterId → adapter instances  
- Dispose timers: Map for auto-cleanup scheduling
- Loading cache: Map of language → loaded factory classes

**Event-Driven Architecture**:
Registry emits lifecycle events ('factoryRegistered', 'adapterCreated', etc.) enabling monitoring and extensibility.

## Important Patterns and Conventions

**Naming Conventions**:
- Package pattern: `@debugmcp/adapter-{language}`
- Factory class pattern: `{Language}AdapterFactory`
- Adapter ID generation for instance tracking

**Configuration**:
- Dynamic loading opt-in via config flag or `MCP_CONTAINER` environment variable
- Configurable instance limits, auto-dispose timeouts, and validation settings
- Backward compatibility preservation for existing unit tests

**Error Handling**:
- Distinction between MODULE_NOT_FOUND (missing packages) vs configuration errors
- Graceful degradation when dynamic loading fails
- Robust cleanup during disposal operations

**Resource Management**:
- Instance limit enforcement per language
- Auto-dispose on disconnect/error states with configurable timeouts
- Comprehensive cleanup of timers, maps, and adapter instances during shutdown

The module serves as the foundation for debugMCP's pluggable architecture, enabling seamless integration of language-specific debug adapters while providing robust lifecycle management and error handling.
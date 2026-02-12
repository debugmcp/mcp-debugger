# src\adapters/
@generated: 2026-02-12T21:05:46Z

## Purpose
The adapters module provides the core infrastructure for dynamic debugger adapter management in debugMCP. It handles the discovery, loading, registration, and lifecycle management of debug adapters for different programming languages, enabling flexible runtime configuration and automatic resource management.

## Core Components

**AdapterLoader** (`adapter-loader.ts`): Dynamic discovery and loading system that resolves adapter packages using multiple fallback strategies. Implements a robust loading chain from NPM packages to monorepo paths with createRequire fallback for compatibility.

**AdapterRegistry** (`adapter-registry.ts`): Central management hub that maintains active adapter instances and their factories. Provides lifecycle control including creation, tracking, auto-disposal, and resource limits with event-driven notifications.

## Public API Surface

**Primary Entry Points**:
- `AdapterRegistry.getAdapterRegistry()`: Singleton access to the registry instance
- `registry.create(language, config)`: Main adapter instantiation method with dynamic loading support
- `registry.register(language, factory)`: Manual factory registration for static adapters
- `registry.listAvailableAdapters()`: Discovery of all available adapters with installation status

**Discovery & Metadata APIs**:
- `registry.getSupportedLanguages()`: Currently registered language support
- `registry.getAdapterInfo(language)`: Factory metadata and active instance counts
- `listLanguages()`: Combined view of registered and dynamically available adapters

**Lifecycle Management**:
- `registry.disposeAll()`: Cleanup all active adapters and resources
- `registry.unregister(language)`: Remove factory and dispose associated instances

## Internal Organization & Data Flow

**Loading Chain** (AdapterLoader):
1. Cache lookup for previously loaded factories
2. Package name resolution using `@debugmcp/adapter-{language}` convention
3. Progressive import: direct package → node_modules path → monorepo path → createRequire
4. Factory class instantiation and validation
5. Cache storage for future requests

**Registry Management Flow**:
1. Factory registration (manual or dynamic via loader)
2. Adapter creation with dependency injection and instance limits
3. Active instance tracking with state monitoring
4. Auto-dispose setup on disconnect/error states
5. Resource cleanup and event emission

**Configuration Integration**:
- Dynamic loading enabled via configuration or `MCP_CONTAINER` environment variable
- Configurable auto-dispose timeouts (default 5 minutes)
- Per-language instance limits (default 10)
- Validation and override controls for factory registration

## Key Patterns & Conventions

**Adapter Discovery**: Uses consistent naming patterns (`@debugmcp/adapter-{language}` packages, `{Language}AdapterFactory` classes) enabling predictable dynamic loading.

**Dependency Injection**: Registry creates production dependencies (logger, fileSystem, environment) for each adapter instance, promoting testability and modularity.

**Event-Driven Architecture**: Registry emits lifecycle events (factoryRegistered, adapterCreated, etc.) enabling loose coupling and monitoring integration.

**Resource Management**: Automatic disposal timers and instance limits prevent resource leaks, with graceful error handling during cleanup operations.

**Singleton Pattern**: Registry uses singleton access pattern while supporting reset functionality for testing environments.

## Integration Points

**Shared Interfaces**: Leverages `@debugmcp/shared` for core adapter contracts (`IAdapterFactory`, `IAdapterRegistry`) ensuring consistent integration across the system.

**Container Dependencies**: Integrates with dependency injection container to provide consistent service instances (logging, file system, environment) to adapters.

**Error Handling**: Provides detailed error context distinguishing installation issues (MODULE_NOT_FOUND) from configuration problems, with specific user guidance.
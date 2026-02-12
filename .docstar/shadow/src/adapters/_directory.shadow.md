# src\adapters/
@generated: 2026-02-12T21:00:55Z

## Purpose
The `adapters` directory provides a comprehensive adapter management system for debugMCP, handling the dynamic discovery, loading, registration, and lifecycle management of debugger adapters for different programming languages. This module serves as the core infrastructure for making language-specific debugging capabilities available to the MCP framework.

## Architecture Overview
The module implements a two-layer architecture:

1. **Dynamic Loading Layer** (`adapter-loader.ts`): Handles runtime discovery and loading of adapter packages
2. **Registry Layer** (`adapter-registry.ts`): Manages adapter factory registration, instance creation, and lifecycle

## Key Components

### AdapterLoader
- **Purpose**: Dynamic adapter discovery and loading system
- **Capabilities**: Multi-tier package resolution with fallback strategies
- **Naming Convention**: Follows `@debugmcp/adapter-{language}` package pattern
- **Loading Strategy**: Primary package import → node_modules fallback → monorepo paths → createRequire CJS compatibility
- **Supported Languages**: mock, python, javascript, rust, go

### AdapterRegistry 
- **Purpose**: Central registry and lifecycle manager for adapter instances
- **Pattern**: Singleton with event-driven architecture extending EventEmitter
- **Configuration**: Configurable validation, instance limits, auto-disposal
- **State Management**: Tracks factories, active adapters, and disposal timers

## Public API Surface

### Primary Entry Points
- `getAdapterRegistry()`: Singleton access to the main registry
- `AdapterRegistry.create(language, config)`: Creates adapter instances with full lifecycle management
- `AdapterRegistry.register(language, factory)`: Manual factory registration
- `AdapterRegistry.listAvailableAdapters()`: Discovery of all available adapters

### Discovery & Metadata
- `getSupportedLanguages()`: Lists registered languages
- `getAdapterInfo(language)`: Factory metadata and instance counts
- `isAdapterAvailable(language)`: Non-throwing availability checks

### Lifecycle Management
- Auto-dispose functionality with configurable timeouts (default 5 minutes)
- Instance limit enforcement per language (default 10)
- Graceful cleanup via `disposeAll()`

## Data Flow & Integration

1. **Discovery**: AdapterLoader scans for available adapter packages using naming conventions
2. **Registration**: Factories are registered either manually or through dynamic loading
3. **Creation**: Registry creates adapter instances on demand, enforcing limits and setting up monitoring
4. **Lifecycle**: Auto-disposal monitors adapter states and cleans up disconnected/errored instances
5. **Events**: Registry emits lifecycle events for monitoring and integration

## Configuration & Behavior

- **Dynamic Loading**: Enabled via `enableDynamicLoading` config or `MCP_CONTAINER` environment variable
- **Validation**: Optional factory validation during registration
- **Override Protection**: Configurable duplicate registration handling
- **Auto-Disposal**: Automatic cleanup of inactive adapters with timer-based disposal

## Dependencies
- **Core**: `@debugmcp/shared` for interfaces and error types
- **Infrastructure**: Winston logging, Node.js module system
- **Integration**: Container dependencies for production adapter creation

This module serves as the foundational infrastructure enabling debugMCP to support multiple programming languages through a unified, extensible adapter system with robust error handling and lifecycle management.
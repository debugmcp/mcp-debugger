# src\adapters/
@children-hash: 3328dc163a775ec4
@generated: 2026-02-15T09:01:26Z

## Purpose
The `src/adapters` directory provides the core adapter management infrastructure for debugMCP, enabling dynamic discovery, loading, and lifecycle management of debugger adapters for different programming languages. This module serves as the foundation for pluggable debugger support, allowing the system to work with various language runtimes through standardized adapter interfaces.

## Key Components

**AdapterLoader (`adapter-loader.ts`)**: Dynamic adapter discovery and loading system that:
- Implements multi-tier resolution strategy for finding adapter packages
- Manages adapter package naming conventions (`@debugmcp/adapter-{language}`)
- Provides robust fallback mechanisms (direct import → node_modules → monorepo paths → createRequire)
- Handles factory class instantiation with caching and error recovery
- Supports both installed packages and development environments

**AdapterRegistry (`adapter-registry.ts`)**: Central registry and lifecycle manager that:
- Maintains factory registration and active adapter instance tracking
- Implements singleton pattern with configurable behavior
- Provides auto-dispose functionality with timeout-based cleanup
- Enforces instance limits per language to prevent resource exhaustion
- Integrates with AdapterLoader for on-demand adapter discovery
- Emits lifecycle events for monitoring and integration

## Architecture & Data Flow

The components work together in a layered architecture:

1. **Discovery Layer**: AdapterLoader discovers and loads adapter factories using progressive resolution
2. **Registry Layer**: AdapterRegistry manages factory registration and creates adapter instances
3. **Lifecycle Layer**: Registry tracks active adapters, handles auto-disposal, and manages resource cleanup

**Typical Flow**:
1. Client requests adapter for a language via Registry.create()
2. Registry checks for registered factory, falls back to AdapterLoader if dynamic loading enabled
3. AdapterLoader attempts package resolution and factory instantiation with caching
4. Registry creates adapter instance, sets up auto-dispose monitoring, and tracks lifecycle
5. Registry handles cleanup through dispose timers or explicit disposal calls

## Public API Surface

**Primary Entry Points**:
- `getAdapterRegistry()`: Singleton registry access
- `AdapterRegistry.create(language, config)`: Main adapter creation method
- `AdapterRegistry.register(language, factory)`: Manual factory registration
- `AdapterRegistry.listAvailableAdapters()`: Discovery of installed/available adapters

**Discovery & Metadata**:
- `getSupportedLanguages()`: Currently registered languages
- `getAdapterInfo(language)`: Factory metadata and instance counts
- `isAdapterAvailable(language)`: Non-throwing availability check

**Lifecycle Management**:
- `disposeAll()`: Cleanup all adapters and resources
- Auto-dispose functionality with configurable timeouts
- Event-driven monitoring ('factoryRegistered', 'adapterCreated', etc.)

## Internal Organization

**Configuration Management**: Centralized defaults with environment-based overrides for dynamic loading, auto-dispose behavior, and instance limits.

**Caching Strategy**: Multi-level caching including factory cache in AdapterLoader and active adapter tracking in AdapterRegistry to optimize performance and resource usage.

**Error Handling**: Comprehensive error categorization distinguishing installation issues from configuration problems, with user-friendly guidance and graceful degradation.

**Naming Conventions**: Standardized package naming (`@debugmcp/adapter-{language}`) and factory class patterns (`{Language}AdapterFactory`) enabling predictable discovery.

## Important Patterns

**Plugin Architecture**: Supports both compile-time registration and runtime discovery of adapters, enabling extensibility without core system modification.

**Resource Management**: Implements automatic cleanup patterns with dispose timers and instance tracking to prevent resource leaks in long-running services.

**Environment Adaptation**: Handles various deployment scenarios including development monorepos, npm installations, and bundled distributions through flexible module loading strategies.

**Event-Driven Design**: Registry emits lifecycle events enabling integration with monitoring, logging, and management systems without tight coupling.
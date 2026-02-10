# src/adapters/
@generated: 2026-02-10T01:19:39Z

## Adapters Module

**Overall Purpose**: The adapters module provides a comprehensive system for managing debug adapters in the DebugMCP ecosystem. It handles dynamic discovery, loading, registration, lifecycle management, and disposal of language-specific debug adapters.

**Key Components**:

1. **AdapterLoader** (`adapter-loader.ts`): Dynamic adapter discovery and loading system
   - Implements sophisticated fallback mechanisms for different deployment scenarios
   - Handles module resolution for npm packages, monorepos, and bundled contexts
   - Provides caching to optimize repeated loading operations
   - Manages adapter availability checking and metadata collection

2. **AdapterRegistry** (`adapter-registry.ts`): Central registry and lifecycle manager
   - Manages factory registration and adapter instance creation
   - Implements configurable auto-dispose with timeout-based cleanup
   - Enforces instance limits per language to prevent resource exhaustion
   - Provides event-driven notifications for lifecycle events

**Component Interaction**:
The AdapterRegistry serves as the primary orchestrator, leveraging AdapterLoader for dynamic discovery when adapters aren't pre-registered. The loader acts as a fallback mechanism that attempts to resolve and load adapters on-demand, while the registry maintains active instances and handles their complete lifecycle.

**Public API Surface**:

**Primary Entry Points**:
- `getAdapterRegistry()`: Singleton access to the central registry
- `AdapterRegistry.create(language, config)`: Main adapter creation method
- `AdapterRegistry.register(language, factory)`: Manual adapter registration

**Discovery & Metadata**:
- `listLanguages()`: Get all supported languages (registered + discoverable)
- `listAvailableAdapters()`: Detailed adapter metadata with installation status
- `getAdapterInfo(language)`: Factory details and active instance counts

**Lifecycle Management**:
- `disposeAll()`: Cleanup all active adapters and resources
- Auto-dispose functionality with configurable timeouts

**Internal Organization**:

**Data Flow**:
1. Adapter request → Registry checks registered factories
2. If not found → AdapterLoader attempts dynamic loading with fallback chain
3. Factory validation and instance creation with dependency injection
4. Active instance tracking and auto-dispose timer setup
5. State monitoring and cleanup on disconnect/error conditions

**Key Patterns**:
- **Singleton Registry**: Central point of control with singleton access pattern
- **Dynamic Loading**: Fallback-based module resolution with multiple strategies
- **Factory Pattern**: Adapter creation through registered factory classes
- **Event-Driven**: Lifecycle notifications through EventEmitter pattern
- **Auto-Cleanup**: Timeout-based disposal for resource management
- **Caching**: Performance optimization for repeated operations

**Configuration**:
- Environment-based dynamic loading enablement (`MCP_CONTAINER`)
- Configurable timeouts, instance limits, and validation settings
- Flexible deployment support for various packaging scenarios

**Critical Dependencies**:
- `@debugmcp/shared`: Core interfaces (IAdapterRegistry, IAdapterFactory)
- Winston logging for debugging and error reporting
- Node.js module system utilities for dynamic imports

The module provides a robust foundation for adapter management with production-ready features like resource limits, automatic cleanup, comprehensive error handling, and flexible deployment support.
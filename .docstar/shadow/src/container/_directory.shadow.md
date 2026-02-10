# src/container/
@generated: 2026-02-10T01:19:38Z

## Container Module - Dependency Injection System

This module implements the core dependency injection container for the debug-mcp application, providing centralized dependency management and configuration for all application services.

### Overall Purpose

The container module serves as the application's composition root, responsible for:
- Defining the complete dependency graph through TypeScript interfaces
- Creating and wiring all production dependencies with their concrete implementations
- Managing configuration for logging, session management, and adapter registry
- Providing a single entry point for application initialization

### Key Components and Integration

**Configuration Layer (`types.ts`)**
- `ContainerConfig`: Defines logging configuration (level, file output, session directories)
- `SessionManagerConfig`: Specialized config for session management and DAP integration
- Type-safe, optional property interfaces for flexible service configuration

**Dependency Factory (`dependencies.ts`)**
- `Dependencies` interface: Central contract defining all application dependencies
- `createProductionDependencies()`: Main factory function that builds the complete dependency graph
- Hierarchical dependency wiring with explicit dependency injection patterns

### Public API Surface

**Primary Entry Point:**
- `createProductionDependencies(config?: ContainerConfig)`: Creates fully configured Dependencies object

**Key Types:**
- `Dependencies`: Complete dependency container interface
- `ContainerConfig`: Configuration for container initialization
- `SessionManagerConfig`: Session-specific configuration options

### Internal Organization and Data Flow

**Dependency Layers:**
1. **Core Services**: Logger, Environment, FileSystem, ProcessManager, NetworkManager
2. **Process Launchers**: Hierarchical launcher chain (ProcessLauncher → ProxyProcessLauncher → DebugTargetLauncher)
3. **Factories**: ProxyManagerFactory, SessionStoreFactory for creating domain objects
4. **Adapter Registry**: Dynamic loading system with bundled and container-specific adapters

**Wiring Pattern:**
- Configuration flows down from ContainerConfig to individual service configurations
- Dependencies are created in dependency order, with each layer depending on the previous
- Adapter registry uses dynamic imports for on-demand loading with validation separation

### Important Patterns and Conventions

**Dependency Injection:**
- Constructor injection with explicit dependency passing
- Interface-based contracts for all major components
- Factory pattern for complex object creation

**Configuration Management:**
- Optional configuration properties with sensible defaults
- Environment-based conditional loading (MCP_CONTAINER flag)
- Separation of container-level and domain-specific configuration

**Dynamic Loading:**
- Fire-and-forget dynamic imports for optional adapters
- Registration-time vs creation-time validation separation
- Graceful handling of missing optional components

This module serves as the foundation for the entire application's object graph, enabling testability, modularity, and flexible configuration across different deployment scenarios.
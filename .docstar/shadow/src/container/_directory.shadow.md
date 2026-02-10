# src/container/
@generated: 2026-02-10T21:26:20Z

## Container Module - Dependency Injection System

This module implements the core dependency injection container for the debug-mcp application, providing centralized dependency management and configuration for the entire debugging/MCP (Model Context Protocol) ecosystem.

### Overall Purpose

The container module serves as the application's composition root, responsible for:
- Wiring together all production dependencies with their concrete implementations
- Managing the complete dependency graph including services, launchers, factories, and adapters
- Providing flexible configuration options for logging, session management, and DAP integration
- Supporting both bundled and dynamically loaded MCP adapters

### Key Components and Relationships

**Configuration Layer (`types.ts`)**
- `ContainerConfig`: Main container configuration interface controlling logging behavior, session directories, and extensible logger options
- `SessionManagerConfig`: Specialized configuration for session management with storage settings and DAP launch parameters
- Both interfaces use optional properties for maximum flexibility and compose together for complete system configuration

**Dependency Container (`dependencies.ts`)**
- `Dependencies` interface: Central contract defining the complete application dependency surface
- `createProductionDependencies()`: Main factory function that creates the entire wired dependency graph
- Organizes dependencies into logical groups: core services, process launchers, factories, and adapter registry

### Public API Surface

**Primary Entry Point:**
- `createProductionDependencies(config?: ContainerConfig): Dependencies` - Main factory for production dependency graph creation

**Configuration Types:**
- `ContainerConfig` - Container-level configuration interface
- `SessionManagerConfig` - Session management specific configuration

**Dependency Groups Exposed:**
- Core implementations (Logger, Environment, FileSystem, ProcessManager, NetworkManager)
- Process launcher hierarchy (ProcessLauncher → ProxyProcessLauncher → DebugTargetLauncher)
- Factory instances (ProxyManagerFactory, SessionStoreFactory)
- Adapter registry with dynamic loading capabilities

### Internal Organization and Data Flow

1. **Configuration Processing**: Optional `ContainerConfig` parameter flows through to configure individual services
2. **Layered Dependency Construction**: Dependencies built in order with explicit passing between layers
3. **Process Launcher Hierarchy**: Multi-level wrapping pattern where each launcher enhances the previous layer
4. **Adapter Registry Setup**: Two-phase approach with bundled adapters registered immediately and container-specific adapters loaded dynamically
5. **Factory Wiring**: Factories receive pre-configured dependencies for consistent object creation

### Important Patterns and Conventions

- **Fire-and-forget Dynamic Loading**: Optional adapters loaded asynchronously without blocking startup
- **Separation of Concerns**: Registration-time vs creation-time validation for adapter registry
- **Environment Conditional Logic**: Uses `MCP_CONTAINER` flag to determine adapter loading strategy
- **Composition Root Pattern**: Single location for complete dependency graph assembly
- **Optional Configuration**: All configuration parameters are optional with sensible defaults
- **Type-safe Extensibility**: Generic types and optional properties allow customization while maintaining type safety

This module enables clean dependency injection throughout the application while supporting both development and production scenarios with dynamic adapter capabilities.
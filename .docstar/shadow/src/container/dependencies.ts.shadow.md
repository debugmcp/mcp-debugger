# src/container/dependencies.ts
@source-hash: 33a382c684f87d09
@generated: 2026-02-10T00:41:50Z

## Central Dependency Container

This file implements the main dependency injection container for the debug-mcp application, responsible for wiring together all production dependencies with their concrete implementations.

### Primary Purpose
Creates and configures the complete dependency graph for production use, including core services, process launchers, factories, and adapter registry with dynamic loading capabilities.

### Key Components

**Dependencies Interface (L45-64)**
- Defines the complete contract for all application dependencies
- Groups dependencies into: core implementations, process launchers, factories, and adapter support
- Serves as the main dependency container type

**createProductionDependencies Function (L71-171)**
- Main factory function that creates the entire dependency graph
- Takes optional ContainerConfig for service configuration
- Returns fully wired Dependencies object for production use

### Dependency Wiring Structure

**Core Services (L73-83)**
- Logger with configurable level/file output
- Environment, FileSystem, ProcessManager, NetworkManager implementations

**Process Launchers (L86-88)**
- ProcessLauncher -> ProxyProcessLauncher -> DebugTargetLauncher hierarchy
- Each launcher wraps lower-level components with additional functionality

**Factories (L91-97)**
- ProxyManagerFactory: Creates proxy managers with launcher/filesystem dependencies
- SessionStoreFactory: Creates session storage instances

**Adapter Registry (L102-156)**
- Configured with validation disabled during registration (validated at creation time)
- Dynamic loading enabled for on-demand adapter discovery
- Handles bundled adapters via global registry (L109-123)
- Container-specific adapter preloading (L127-156) for mock, python, javascript, rust, go, java

### Key Dependencies
- `@debugmcp/shared`: Core interfaces and types
- `../implementations/`: Concrete service implementations  
- `../factories/`: Factory implementations
- `../utils/`: Logging and language configuration utilities

### Notable Patterns
- Fire-and-forget dynamic imports for optional adapters in container mode
- Layered dependency injection with explicit dependency passing
- Separation of registration-time and creation-time validation
- Environment-based conditional loading (MCP_CONTAINER flag)
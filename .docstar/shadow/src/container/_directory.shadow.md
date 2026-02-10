# src/container/
@generated: 2026-02-09T18:16:02Z

## Purpose and Responsibility

The `src/container` directory implements a dependency injection container system that serves as the composition root for the debug MCP (Model Context Protocol) application. It provides centralized assembly and configuration of all application dependencies, supporting both development and production environments with configurable logging, session management, and dynamic adapter loading.

## Key Components

### Core Files
- **`dependencies.ts`**: Main dependency factory that creates and wires all application services
- **`types.ts`**: TypeScript configuration interfaces for container setup

### Component Relationships
The container follows a layered dependency injection architecture:
1. **Core Services Layer**: Filesystem, process/network managers, logger, environment services
2. **Process Launcher Layer**: Hierarchical process management (`ProcessLauncherImpl` → `ProxyProcessLauncherImpl` → `DebugTargetLauncherImpl`)
3. **Factory Layer**: `ProxyManagerFactory` and `SessionStoreFactory` for runtime object creation
4. **Adapter Registry Layer**: Dynamic adapter loading and management system

## Public API Surface

### Primary Entry Point
- `createProductionDependencies(config: ContainerConfig): Dependencies` - Main factory function that assembles complete dependency graph

### Configuration Interfaces
- `ContainerConfig` - Container-wide configuration (logging, session directories)
- `SessionManagerConfig` - Session management and DAP launch configuration
- `Dependencies` - Complete dependency contract defining all required services

## Internal Organization and Data Flow

### Dependency Assembly Flow
1. Logger creation with configurable options
2. Core service instantiation with concrete implementations
3. Process launcher hierarchy construction with dependency injection
4. Factory creation for proxy and session management
5. Adapter registry configuration with dynamic loading
6. Bundled adapter registration from global registry
7. Conditional container-mode adapter pre-registration

### Adapter System Architecture
- Global bundled adapter registry via `__DEBUG_MCP_BUNDLED_ADAPTERS__`
- Dynamic adapter loading with fire-and-forget imports
- Language-based filtering with environment variable disabling
- Support for multiple adapter types (mock, python, javascript, rust, go, java)

## Important Patterns and Conventions

### Design Patterns
- **Composition over Inheritance**: Interface segregation with concrete implementations
- **Factory Pattern**: For proxy managers and session storage
- **Dependency Injection**: Hierarchical service wiring with interface contracts

### Error Handling
- Fire-and-forget dynamic imports prevent blocking during dependency creation
- Promise-aware error handling for async adapter registration
- Environment-based conditional loading (`MCP_CONTAINER` checks)

### Configuration Strategy
- Optional property pattern throughout configuration interfaces
- Extensible logger options via generic object typing
- Separation of concerns between container and session-specific configuration

The container module serves as the central nervous system of the application, orchestrating service creation, dependency wiring, and dynamic component loading while maintaining strict type safety and flexible configuration options.
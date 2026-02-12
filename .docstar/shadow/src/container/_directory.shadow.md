# src\container/
@generated: 2026-02-12T21:00:54Z

## Overall Purpose

The `src/container` module serves as the application's dependency injection foundation, providing centralized configuration and wiring of all core services, adapters, and components for a debugging/session management system. It implements a production-ready IoC container that orchestrates the entire application dependency graph.

## Key Components & Relationships

**Configuration Layer (`types.ts`)**:
- `ContainerConfig`: Defines logging, session storage, and DAP launch configuration
- `SessionManagerConfig`: Specialized settings for session management components
- Provides type-safe contracts for container initialization

**Dependency Container (`dependencies.ts`)**:
- `Dependencies` interface: Complete service registry defining all injectable components
- `createProductionDependencies()`: Factory function that materializes the full dependency graph
- Orchestrates four major subsystems:
  1. **Core Services**: File system, process management, networking, logging
  2. **Process Launchers**: Hierarchical process execution (base → proxy → debug target)
  3. **Service Factories**: Dynamic object creation for complex components
  4. **Adapter Registry**: Language adapter loading and registration system

## Public API Surface

**Primary Entry Point**:
- `createProductionDependencies(config: ContainerConfig): Dependencies`
  - Main factory for production dependency container
  - Accepts configuration for logging, session management, and DAP settings
  - Returns fully wired dependency graph ready for application use

**Key Interfaces**:
- `Dependencies`: Complete service registry interface
- `ContainerConfig`: Configuration contract for container initialization
- `SessionManagerConfig`: Session-specific configuration subset

## Internal Organization & Data Flow

**Initialization Flow**:
1. Configuration validation and defaults application
2. Core service instantiation (filesystem, process manager, logger)
3. Process launcher chain construction (base → proxy → debug)
4. Factory registration for dynamic object creation
5. Adapter registry setup with language-specific loading
6. Final dependency container assembly

**Adapter System Integration**:
- Dynamic adapter discovery and registration
- Environment-aware loading (container vs standalone deployment)
- Fire-and-forget registration to prevent startup blocking
- Support for both bundled and runtime-loaded language adapters

## Important Patterns & Conventions

**Architectural Patterns**:
- **Dependency Injection**: Single-point dependency graph creation
- **Factory Pattern**: Separate factories for complex service instantiation
- **Registry Pattern**: Centralized adapter management and discovery
- **Configuration-driven**: Behavior modification through typed configuration objects

**Error Handling Strategy**:
- Graceful degradation for missing optional components
- Deferred validation to usage time rather than registration
- Non-blocking adapter loading with error isolation

**Environment Adaptation**:
- Container-aware deployment detection
- Language-specific adapter enabling/disabling
- Configurable logging levels and output destinations

This module serves as the application's bootstrap layer, transforming configuration into a fully operational service ecosystem ready for debugging session management and DAP integration.
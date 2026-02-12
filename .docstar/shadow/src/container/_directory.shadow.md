# src\container/
@generated: 2026-02-12T21:05:39Z

## Overall Purpose

The `container` module serves as the dependency injection foundation for the debugging/session management system. It provides centralized configuration types and a production-ready dependency container that wires together all core services, process management components, and language adapters into a cohesive runtime environment.

## Key Components and Architecture

The module consists of two complementary components:

**Configuration Layer (`types.ts`)**:
- `ContainerConfig`: Defines logging configuration including log levels, file output, and session-specific logging directories
- `SessionManagerConfig`: Specialized configuration for session management with storage parameters and DAP (Debug Adapter Protocol) launch settings
- Provides flexible, optional configuration contracts with extensible logger options

**Dependency Injection Layer (`dependencies.ts`)**:
- `Dependencies` interface: Complete contract defining all injectable services across the application
- `createProductionDependencies()`: Primary factory function that instantiates and wires the entire dependency graph

## Public API Surface

**Primary Entry Point**:
- `createProductionDependencies(config: ContainerConfig): Dependencies` - Main factory for creating production dependency container

**Key Interfaces**:
- `Dependencies` - Complete dependency container interface
- `ContainerConfig` - Container configuration contract
- `SessionManagerConfig` - Session-specific configuration contract

## Internal Organization and Data Flow

The dependency creation follows a hierarchical pattern:

1. **Core Infrastructure**: Base services (filesystem, process manager, network, logging)
2. **Process Management**: Layered launchers (base → proxy → debug target specialized)
3. **Dynamic Factories**: Service factories for runtime object creation
4. **Adapter Ecosystem**: Language adapter registry with dynamic loading and pre-registration

The container supports both bundled and dynamically loaded adapters, with environment-specific behavior for container vs non-container deployments.

## Important Patterns and Conventions

- **Dependency Injection**: Single factory creates complete dependency graph with proper wiring
- **Configuration-Driven**: All components configured through type-safe configuration objects
- **Graceful Degradation**: Adapter registration is fire-and-forget to prevent blocking startup
- **Environment Awareness**: Adapts behavior based on deployment context (container vs standalone)
- **Extensibility**: Registry pattern allows dynamic language adapter discovery and loading
- **Type Safety**: Comprehensive TypeScript interfaces provide compile-time guarantees while allowing runtime flexibility
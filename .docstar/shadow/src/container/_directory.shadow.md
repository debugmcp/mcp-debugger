# src/container/
@generated: 2026-02-11T23:47:35Z

## Purpose and Responsibility

The `src/container` module implements the dependency injection system for a debugging/session management application. It provides centralized configuration and instantiation of all application dependencies, creating a complete dependency graph for production use with proper service wiring and adapter registration.

## Key Components and Relationships

**Core Architecture**:
- **`types.ts`**: Defines configuration contracts (`ContainerConfig`, `SessionManagerConfig`) that specify how the container should be initialized
- **`dependencies.ts`**: Implements the actual dependency container creation and service wiring through the `createProductionDependencies()` factory function

**Service Categories**:
1. **Infrastructure Services**: File system, process management, networking, logging, and environment access
2. **Process Launchers**: Hierarchical process management with base, proxy, and debug-specific launchers
3. **Factory Services**: Dynamic object creation for proxy managers and session stores
4. **Adapter System**: Language adapter registry with dynamic loading and pre-registration capabilities

## Public API Surface

**Main Entry Point**:
- `createProductionDependencies(config: ContainerConfig): Dependencies` - Primary factory function that creates the complete dependency graph

**Configuration Interfaces**:
- `ContainerConfig` - Container-level configuration (logging, session directories)
- `SessionManagerConfig` - Session management specific settings (storage, DAP parameters)
- `Dependencies` - Complete dependency container interface defining all injectable services

## Internal Organization and Data Flow

**Initialization Flow**:
1. Configuration validation and logger setup
2. Core infrastructure service instantiation
3. Process launcher hierarchy creation
4. Factory service registration
5. Adapter system initialization with dynamic loading
6. Complete dependency container assembly

**Adapter Management**:
- Registry-based adapter discovery and registration
- Support for both bundled and dynamically loaded adapters
- Environment-aware adapter enabling/disabling
- Fire-and-forget registration with graceful error handling

## Important Patterns and Conventions

**Design Patterns**:
- **Dependency Injection**: Single factory creates entire dependency graph with proper service wiring
- **Factory Pattern**: Separate factories for complex object creation (proxy managers, session stores)
- **Registry Pattern**: Centralized adapter registration and discovery system

**Configuration Strategy**:
- Optional properties throughout for flexible deployment scenarios
- Environment-specific behavior detection (container vs non-container)
- Separation of concerns between container-level and domain-specific configuration

**Error Handling**:
- Graceful degradation for missing or failed adapter loading
- Validation deferred to usage time rather than registration time
- Non-blocking startup with fire-and-forget adapter registration

This module serves as the composition root for the entire application, ensuring all services are properly configured and wired together for production use while maintaining flexibility for different deployment scenarios.
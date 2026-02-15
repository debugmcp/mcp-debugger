# src\container/
@children-hash: 075d69170eb9b1d4
@generated: 2026-02-15T09:01:20Z

## Overview

The `src/container` directory provides the dependency injection infrastructure for the debugging/session management system. It serves as the central bootstrapping module that wires together all application dependencies and provides type-safe configuration interfaces for container initialization.

## Key Components

### Configuration Types (`types.ts`)
- **ContainerConfig**: Core container configuration interface for logging setup, session directories, and extensible logger options
- **SessionManagerConfig**: Specialized configuration for session management with DAP (Debug Adapter Protocol) integration settings

### Dependency Container (`dependencies.ts`)
- **Dependencies Interface**: Complete contract defining all injectable services across the application
- **createProductionDependencies()**: Main factory function that creates the full production dependency graph

## Architecture & Organization

The module follows a layered dependency injection pattern:

1. **Configuration Layer**: Type-safe interfaces define container and service configuration contracts
2. **Service Categories**: Dependencies are organized into logical groups:
   - Core Services (filesystem, process management, networking, logging)
   - Process Launchers (hierarchical process management with proxy and debug capabilities)
   - Factories (dynamic object creation for proxy managers and session stores)
   - Adapter System (language adapter registration and loading)

3. **Initialization Flow**: Single factory function creates entire dependency graph with proper wiring

## Public API Surface

### Primary Entry Points
- `createProductionDependencies(config: ContainerConfig): Dependencies` - Main factory for production container
- `Dependencies` interface - Complete dependency container contract
- `ContainerConfig` & `SessionManagerConfig` interfaces - Configuration types

### Key Capabilities
- **Environment-Aware Initialization**: Adapts behavior for container vs non-container deployment
- **Dynamic Adapter Loading**: Supports both bundled and runtime-loaded language adapters
- **Hierarchical Process Management**: Layered process launchers with proxy and debug specializations
- **Flexible Configuration**: Optional configuration properties with extensible logger options

## Internal Patterns

- **Dependency Injection**: Single factory creates and wires entire dependency graph
- **Factory Pattern**: Specialized factories for complex object creation (proxy managers, session stores)
- **Registry Pattern**: Centralized adapter registration with graceful error handling
- **Configuration-Driven**: Behavior controlled through type-safe configuration interfaces

## Integration Points

The container serves as the bridge between:
- Core implementations (`../implementations/`)
- Shared interfaces (`@debugmcp/shared`)
- Language adapters (dynamically loaded)
- Session management and DAP integration
- Process management and proxy systems

This module is typically used during application startup to bootstrap the entire system with properly configured and wired dependencies.
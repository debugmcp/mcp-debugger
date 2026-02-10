# src/adapters/
@generated: 2026-02-10T21:26:20Z

## Overview

The `src/adapters` directory implements the core adapter management infrastructure for the DebugMCP system. It provides a two-tier architecture for dynamic discovery, loading, and lifecycle management of debug adapters across different programming languages.

## Core Components

### AdapterLoader (`adapter-loader.ts`)
- **Purpose**: Dynamic module loading system with sophisticated fallback mechanisms
- **Key Features**: 
  - Caches loaded adapters to prevent redundant operations
  - Supports multiple deployment scenarios (npm packages, monorepos, bundled contexts)
  - Implements robust fallback chain with ESM/CommonJS dual loading support
- **Loading Strategy**: Cache check → Package import → Monorepo paths → Factory instantiation
- **API**: `loadAdapter(language)`, `isAdapterAvailable(language)`, `listAvailableAdapters()`

### AdapterRegistry (`adapter-registry.ts`)
- **Purpose**: Central registry for adapter lifecycle management and factory coordination
- **Key Features**:
  - Singleton pattern for system-wide adapter coordination
  - Configurable instance limits and auto-disposal timeout (5min default)
  - Event-driven architecture with comprehensive lifecycle events
  - Optional integration with AdapterLoader for dynamic loading
- **API**: `register()`, `create()`, `unregister()`, `getSupportedLanguages()`, `disposeAll()`

## System Architecture

The components work together in a layered approach:

1. **Discovery Layer**: AdapterLoader handles dynamic discovery and loading of adapter packages
2. **Management Layer**: AdapterRegistry provides centralized factory registration and instance management
3. **Integration**: Registry optionally delegates to loader for unknown languages when dynamic loading is enabled

## Data Flow

1. **Registration**: Adapters register factories via `AdapterRegistry.register()`
2. **Discovery**: Unknown languages trigger dynamic loading via AdapterLoader (if enabled)
3. **Creation**: Registry creates adapter instances with dependency injection and lifecycle tracking
4. **Management**: Auto-dispose timers and instance limits enforce resource constraints
5. **Cleanup**: Comprehensive disposal handling for graceful shutdown

## Public API Surface

### Main Entry Points
- `getAdapterRegistry()`: Singleton registry access
- `AdapterRegistry.create(language, config)`: Primary adapter creation
- `AdapterRegistry.register(language, factory)`: Factory registration
- `AdapterRegistry.listLanguages()`: Available language discovery
- `AdapterLoader.loadAdapter(language)`: Direct dynamic loading

### Key Interfaces
- `IAdapterRegistry`: Registry contract for dependency injection
- `IAdapterFactory`: Factory interface for adapter creation
- `AdapterMetadata`: Package information and installation status

## Configuration & Conventions

### Naming Conventions
- Package names: `@debugmcp/adapter-{language}`
- Factory classes: `{Language}AdapterFactory`
- Export pattern: Default export of factory class

### Configuration Options
- `validateOnRegister`: Factory validation on registration
- `allowOverride`: Permit factory replacement
- `maxInstancesPerLanguage`: Instance limit per language (default: 10)
- `autoDispose`: Enable auto-disposal on disconnect/error
- `autoDisposeTimeout`: Disposal delay (default: 5 minutes)

## Key Patterns

- **Fallback Resilience**: Multiple loading paths with graceful degradation
- **Resource Management**: Automatic cleanup with configurable timeouts
- **Event-Driven**: Comprehensive lifecycle events for monitoring and integration
- **Caching Strategy**: Prevent redundant loading operations while maintaining flexibility
- **Singleton Coordination**: System-wide adapter state management

## Dependencies

- `@debugmcp/shared`: Core interfaces and error types
- `../container/dependencies.js`: Production dependency injection
- Node.js modules: `path`, `url`, `module` for dynamic loading
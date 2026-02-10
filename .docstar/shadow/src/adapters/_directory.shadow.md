# src/adapters/
@generated: 2026-02-09T18:16:10Z

## Purpose
The `src/adapters` directory implements a comprehensive adapter management system for the debug MCP framework. It provides dynamic loading, registration, lifecycle management, and orchestration of language-specific debugger adapters with support for both production deployments and development environments.

## Architecture Overview
The module consists of two primary components working in concert:

**AdapterLoader** (`adapter-loader.ts`) - Dynamic loading engine that handles runtime discovery and instantiation of adapter packages using multi-stage fallback resolution strategies.

**AdapterRegistry** (`adapter-registry.ts`) - Central registry that manages adapter factories, active instances, lifecycle events, and provides the primary API surface for the framework.

## Component Interaction
```
AdapterRegistry (singleton)
    ↓ (delegates loading to)
AdapterLoader 
    ↓ (dynamically imports)
@debugmcp/adapter-{language} packages
    ↓ (instantiates)
Language-specific adapter factories
```

The registry serves as the orchestration layer, while the loader handles the complex module resolution and import mechanics needed to support various deployment contexts.

## Public API Surface

### Primary Entry Points
- **`getAdapterRegistry()`** - Singleton accessor for the global registry instance
- **`AdapterRegistry.create(language, config?)`** - Main adapter instantiation method with dynamic loading
- **`AdapterRegistry.register(language, factory)`** - Manual factory registration
- **`AdapterRegistry.listAvailableAdapters()`** - Discovery of all available adapters with metadata

### Configuration & Management  
- **`AdapterRegistry.getSupportedLanguages()`** - Registered language support
- **`AdapterRegistry.disposeAll()`** - Complete cleanup and resource deallocation
- **`resetAdapterRegistry()`** - Testing utility for registry reset

## Key Features

### Dynamic Loading System
- **Multi-stage resolution**: npm packages → monorepo paths → CommonJS fallback
- **Caching**: Prevents redundant loading of adapter instances
- **Deployment flexibility**: Supports production, development, and bundled environments
- **Error isolation**: Distinguishes missing packages from loading failures

### Lifecycle Management
- **Auto-disposal**: Monitors adapter state and triggers cleanup on disconnect/error
- **Instance limits**: Configurable maximum adapters per language (default: 10)
- **Resource tracking**: Active instance monitoring with automatic cleanup timers
- **Event emission**: Lifecycle events for monitoring and debugging

### Language Support
Built-in registry for: `mock`, `python`, `javascript`, `java`, `rust`, `go`

### Runtime Flexibility
- **Dynamic loading toggle**: Via constructor flag or `MCP_CONTAINER` environment variable
- **Graceful degradation**: Falls back to registered factories when dynamic loading fails
- **Factory validation**: Configurable validation during registration
- **Override protection**: Prevents accidental factory replacement

## Internal Organization

### Data Flow
1. **Registration Phase**: Factories registered via `register()` or loaded dynamically
2. **Creation Phase**: `create()` method orchestrates loading, instantiation, and tracking  
3. **Lifecycle Phase**: Auto-disposal monitors adapter states and manages cleanup
4. **Disposal Phase**: `disposeAll()` provides complete resource cleanup

### Design Patterns
- **Singleton**: Global registry access pattern
- **Factory**: Adapter creation abstraction
- **Observer**: Event-driven lifecycle management
- **Strategy**: Pluggable module loading via dependency injection

### Critical Dependencies
- **`@debugmcp/shared`**: Core interfaces (`IAdapterFactory`, `IAdapter`) and error types
- **Node.js ES Modules**: Dynamic imports and CommonJS compatibility
- **EventEmitter**: Lifecycle event broadcasting
- **Winston**: Structured logging throughout the loading process

The module serves as the foundation for adapter management in the debug MCP framework, providing both flexibility for development workflows and robustness for production deployments.
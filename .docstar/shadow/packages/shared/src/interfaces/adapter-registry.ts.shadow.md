# packages/shared/src/interfaces/adapter-registry.ts
@source-hash: 6f8ace40109ff3b2
@generated: 2026-02-10T00:41:09Z

**Purpose**: TypeScript interface definitions for a debug adapter registry system that manages language-specific debug adapters using the registry pattern with factory-based instantiation.

**Core Interfaces**:

- `IAdapterRegistry (L14-83)`: Main registry interface providing centralized management of debug adapters
  - Registration: `register()`, `unregister()` methods for managing adapter factories
  - Creation: `create()` method for instantiating adapters with async support
  - Discovery: Language support queries and metadata retrieval
  - Lifecycle: Disposal and instance tracking capabilities

- `IAdapterFactory (L88-107)`: Factory interface for creating debug adapter instances
  - `createAdapter()`: Creates instances with dependency injection
  - `getMetadata()`: Returns adapter metadata
  - `validate()`: Async environment validation

**Key Data Structures**:

- `AdapterDependencies (L112-118)`: Dependency injection container with required services (file system, logger, environment, process launcher) and optional network manager
- `AdapterMetadata (L123-150)`: Static adapter information including language, version, capabilities, and UI properties
- `AdapterInfo (L155-167)`: Runtime-enhanced metadata with availability status and instance tracking
- `AdapterRegistryConfig (L213-228)`: Configuration options for registry behavior (validation, overrides, instance limits, auto-disposal)

**Error Handling**:
- `AdapterNotFoundError (L235-243)`: Language not registered
- `FactoryValidationError (L248-256)`: Factory validation failures  
- `DuplicateRegistrationError (L261-266)`: Duplicate language registration

**Implementation Helpers**:
- `BaseAdapterFactory (L191-208)`: Abstract base class with default validation implementation
- Type guards: `isAdapterFactory()` (L273-281), `isAdapterRegistry()` (L286-294)
- Utility types: `AdapterFactoryMap`, `ActiveAdapterMap` (L301-306)

**Dependencies**: 
- Imports `IDebugAdapter` and `AdapterConfig` from debug-adapter interface
- External dependencies from separate interface files (file system, logger, environment, process launcher, network manager)

**Architectural Patterns**:
- Registry pattern for centralized adapter management
- Factory pattern for adapter instantiation
- Dependency injection for adapter dependencies
- Async/Promise-based operations for creation and validation
- Comprehensive error taxonomy with custom error types
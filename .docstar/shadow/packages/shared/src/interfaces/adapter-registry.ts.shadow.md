# packages/shared/src/interfaces/adapter-registry.ts
@source-hash: 6f8ace40109ff3b2
@generated: 2026-02-09T18:14:14Z

## Purpose
Registry pattern implementation for managing language-specific debug adapters. Provides centralized lifecycle management, factory-based adapter creation, and metadata handling for debugger extensions.

## Core Interfaces

**IAdapterRegistry (L14-83)**: Main registry interface providing adapter management
- `register(language, factory)` (L23): Register new adapter factories, throws on duplicates
- `create(language, config)` (L41): Async adapter instance creation with dependency injection
- `getSupportedLanguages()` (L49): Returns array of registered language identifiers
- `disposeAll()` (L76): Cleanup all active adapters and clear registry

**IAdapterFactory (L88-107)**: Factory pattern for adapter instantiation
- `createAdapter(dependencies)` (L94): Creates configured adapter instances
- `validate()` (L106): Async environment validation with detailed results
- `getMetadata()` (L100): Returns adapter metadata for UI/discovery

**AdapterDependencies (L112-118)**: Dependency injection container
- Required: fileSystem, logger, environment, processLauncher
- Optional: networkManager for network-aware adapters

## Data Types

**AdapterMetadata (L123-150)**: Static adapter information
- Core fields: language, displayName, version, author, description
- Optional: documentationUrl, minimumDebuggerVersion, fileExtensions, icon

**AdapterInfo (L155-167)**: Runtime adapter state extending metadata
- `available` (L157): Current adapter availability status
- `activeInstances` (L160): Count of running adapter instances
- `registeredAt` (L166): Registration timestamp for tracking

**FactoryValidationResult (L172-184)**: Validation outcome structure
- `valid` boolean with separate `errors` and `warnings` arrays
- Extensible `details` object for custom validation data

## Implementation Helpers

**BaseAdapterFactory (L191-208)**: Abstract base class for factory implementations
- Provides default validation logic (returns valid with empty errors)
- Concrete implementations must override `createAdapter()`

**AdapterRegistryConfig (L213-228)**: Registry behavior configuration
- `validateOnRegister`, `allowOverride` for registration policies
- `maxInstancesPerLanguage`, `autoDispose` for resource management

## Error Handling

**AdapterNotFoundError (L235-243)**: Language not registered
- Includes available languages list for user guidance

**FactoryValidationError (L248-256)**: Factory validation failures
- Embeds full validation result for debugging

**DuplicateRegistrationError (L261-266)**: Duplicate language registration attempts

## Type Safety

**Type Guards (L273-294)**: Runtime interface validation
- `isAdapterFactory()` and `isAdapterRegistry()` for duck typing
- Check required method presence for interface compliance

**Utility Types (L301-306)**: Type aliases for internal data structures
- `AdapterFactoryMap`: language → factory mapping
- `ActiveAdapterMap`: language → active adapter set mapping

## Dependencies
- Imports `IDebugAdapter`, `AdapterConfig` from debug-adapter module (L9)
- External interfaces: IFileSystem, ILogger, IEnvironment, IProcessLauncher, INetworkManager (L310-314)

## Architecture Notes
- Registry pattern with factory method for adapter creation
- Dependency injection for testability and modularity
- Lifecycle management with disposal and instance tracking
- Validation-first approach with detailed error reporting
- Extensible metadata system for UI integration
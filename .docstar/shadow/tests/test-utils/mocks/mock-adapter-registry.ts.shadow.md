# tests/test-utils/mocks/mock-adapter-registry.ts
@source-hash: 3e0350ca0ec215f2
@generated: 2026-02-10T00:41:30Z

Test utility module providing mock implementations of the IAdapterRegistry interface for comprehensive testing of debug adapter functionality.

## Core Purpose
Creates realistic mock adapter registries with configurable behaviors to test various scenarios including success paths, error conditions, and edge cases in debug adapter management.

## Key Functions

### createMockAdapterRegistry() (L13-140)
Primary mock factory that creates a fully functional IAdapterRegistry mock with:
- Pre-configured support for 'python' and 'mock' languages (L14)
- Realistic AdapterInfo objects with complete metadata (L17-40)
- Mock IDebugAdapter instances returned by `create()` method (L49-124)
- All IAdapterRegistry interface methods mocked with sensible default behavior

Critical implementation detail: `buildAdapterCommand()` (L72-76) constructs adapter launch commands using provided config, defaulting to node with mock-adapter.js.

### createMockAdapterRegistryWithErrors() (L146-157)
Error simulation variant that overrides default behavior to return empty language support and rejected promises. Used for testing error handling paths.

### createMockAdapterRegistryWithLanguages() (L163-192)
Parameterized mock factory accepting custom language arrays. Dynamically generates AdapterInfo objects for each specified language (L173-184).

## Test Helper Functions

### expectAdapterRegistryLanguageCheck() (L197-204)
Assertion helper verifying `isLanguageSupported()` was called with expected parameters and call count.

### expectAdapterCreation() (L209-220)
Assertion helper verifying `create()` method invocation with proper language and config object structure.

### resetAdapterRegistryMock() (L225-232)
Utility to reset all mock function call histories on an adapter registry instance using vitest mock introspection.

## Dependencies
- **vitest**: Mock function creation and management
- **@debugmcp/shared**: Core interfaces (IAdapterRegistry, AdapterInfo, DebugLanguage)

## Architecture Notes
- Comprehensive EventEmitter interface mocking (L108-123) for adapter lifecycle events
- Mock adapters provide full IDebugAdapter interface compliance with DAP protocol operations
- Realistic mock data includes file extensions, versioning, and author information
- Supports testing of adapter installation, connection management, and feature detection workflows
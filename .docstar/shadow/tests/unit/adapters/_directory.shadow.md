# tests\unit\adapters/
@children-hash: bc0fc2138bc73f2f
@generated: 2026-02-15T09:01:23Z

## Overall Purpose
Unit testing directory for debugMCP adapter system components, providing comprehensive test coverage for adapter loading, registration, lifecycle management, and specialized adapter implementations (JavaScript and Mock).

## Architecture & Components

### Core Infrastructure Tests
- **adapter-loader.test.ts**: Tests dynamic adapter loading system with 3-tier fallback mechanism (primary import → node_modules → createRequire)
- **adapter-registry.test.ts**: Tests centralized adapter registration, validation, creation, and lifecycle management
- **js-debug-launch-barrier.test.ts**: Tests launch coordination utility for JavaScript debugging session readiness detection

### Adapter Implementation Tests
- **javascript-debug-adapter.test.ts**: Tests JavaScript-specific debugging adapter implementation with Node.js runtime validation
- **mock-debug-adapter.test.ts**: Tests mock adapter for development/testing scenarios with error injection capabilities

## Key Testing Patterns

### Mock Infrastructure
All tests utilize comprehensive mocking strategies:
- Mock factories for creating adapter stubs with event handling
- Mock dependencies including logger, file system, and network components
- Vitest framework with fake timers for timeout-based testing

### Test Coverage Areas
1. **Dynamic Loading**: Multi-language adapter discovery and fallback mechanisms
2. **Registry Management**: Factory registration, validation, and instance limits
3. **Lifecycle Management**: Initialization, connection, disposal, and auto-cleanup
4. **Error Handling**: Translation, scenario injection, and user-friendly messaging
5. **Feature Support**: Breakpoint types, evaluation capabilities, and adapter-specific features

## Public API Surface Tested

### AdapterLoader
- `loadAdapter()`: Dynamic module loading with fallback chains
- `isAdapterAvailable()`: Availability checking with caching
- `listAvailableAdapters()`: Enumeration of known adapters with installation status

### AdapterRegistry
- `register()/unregister()`: Factory lifecycle management
- `createAdapter()`: Instance creation with limits enforcement
- `disposeAll()`: Bulk cleanup operations

### Specialized Adapters
- Error message translation (`translateErrorMessage()`)
- Feature capability reporting (`supportsFeature()`)
- Launch coordination barriers (`createLaunchBarrier()`)

## Internal Organization

### Test Utilities
Each test file includes factory functions for creating mock objects:
- `createDependencies()`: Standard mock adapter dependencies
- `createAdapterStub()`: Event-capable adapter mocks
- `createFactory()`: Adapter factory mocks with validation

### Error Scenarios
Comprehensive error condition testing:
- Module not found handling
- Factory class validation errors
- Connection timeouts and proxy exits
- Filesystem access errors (ENOENT)

## Important Conventions
- Consistent use of vitest mocking and fake timers
- Dependency injection pattern for testability
- Event-driven lifecycle management
- Cache isolation between adapter types
- Timeout-based resource cleanup validation

This test suite ensures the adapter system's reliability across dynamic loading, registration management, and specialized debugging implementations for multiple programming languages.
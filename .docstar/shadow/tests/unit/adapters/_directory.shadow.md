# tests/unit/adapters/
@generated: 2026-02-09T18:16:12Z

## Overall Purpose

This directory contains comprehensive unit tests for the MCP debugging adapter system, focusing on adapter lifecycle management, dynamic loading, registration, and specific adapter implementations. The test suite validates the core infrastructure that enables dynamic discovery, loading, and management of debug adapters for different programming languages.

## Key Components and Relationships

### Core Infrastructure Tests
- **AdapterLoader Tests** (`adapter-loader.test.ts`): Validates the dynamic loading system with fallback mechanisms, caching, and error handling for adapter discovery
- **AdapterRegistry Tests** (`adapter-registry.test.ts`): Tests centralized adapter lifecycle management, factory registration, instance limits, and auto-disposal features

### Specific Adapter Implementation Tests
- **JavascriptDebugAdapter Tests** (`javascript-debug-adapter.test.ts`): Validates JavaScript-specific debugging features, TypeScript support, and launch coordination
- **MockDebugAdapter Tests** (`mock-debug-adapter.test.ts`): Tests the mock adapter used for development and testing scenarios

### Utility Component Tests
- **JsDebugLaunchBarrier Tests** (`js-debug-launch-barrier.test.ts`): Tests synchronization utilities for coordinating debug session startup timing

## Test Architecture Patterns

### Comprehensive Mocking Strategy
All tests employ extensive mocking of external dependencies (file system, process launcher, network manager, module loading) to ensure isolated unit testing. Mock factories like `createDependencies()` and `createAdapterStub()` provide consistent test fixtures.

### Dynamic Loading Test Coverage
Tests cover the complete adapter loading pipeline:
1. Primary package path resolution (`@debugmcp/adapter-{name}`)
2. Fallback to node_modules locations
3. createRequire as final fallback mechanism
4. Comprehensive error handling with user-friendly messages

### State Management Validation
Tests validate adapter state transitions (READY → CONNECTED → DISCONNECTED) and ensure proper cleanup through disposal patterns and registry management.

## Key Test Utilities

### Mock Adapters and Factories
- Event-handling capable adapter stubs with proper cleanup
- Configurable factory functions with validation and metadata generation
- Consistent adapter configuration structure across all tests

### Async Testing Infrastructure
- Fake timer manipulation for timeout and auto-disposal testing
- Promise-based testing for launch barriers and connection coordination
- Proper async/await patterns throughout test suites

## Critical Validation Areas

### Error Handling and User Experience
- Translation of low-level errors (ENOENT) into actionable user guidance
- Comprehensive error scenarios including missing adapters, validation failures, and connection timeouts
- Proper error propagation with specific error types (DuplicateRegistrationError, FactoryValidationError, AdapterNotFoundError)

### Performance and Resource Management
- Instance limit enforcement with automatic cleanup
- Caching behavior validation to avoid redundant operations
- Auto-disposal mechanisms with configurable timeouts
- Memory leak prevention through proper event handler cleanup

### Development Environment Support
- Monorepo development environment fallback paths
- TypeScript runtime argument deduplication and configuration
- Feature support matrix validation (conditional breakpoints, data breakpoints, evaluate for hovers)

## Integration Points

The tests validate the complete adapter ecosystem from discovery through execution, ensuring that adapters can be dynamically loaded, properly configured, and managed throughout their lifecycle. The test suite provides confidence in the system's ability to handle various adapter types, error conditions, and development scenarios while maintaining proper resource management and user experience.
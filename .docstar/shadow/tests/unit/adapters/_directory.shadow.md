# tests/unit/adapters/
@generated: 2026-02-10T21:26:23Z

## Purpose
This directory contains comprehensive unit test suites for the debug adapter system's core components, validating adapter loading, registration, lifecycle management, and specific adapter implementations (JavaScript and Mock). These tests ensure robust adapter discovery, dynamic loading, error handling, and debugging feature support across the debug adapter ecosystem.

## Core Components and Architecture

### Adapter Infrastructure Tests
- **AdapterLoader** (`adapter-loader.test.ts`): Tests dynamic module loading with fallback mechanisms, package resolution from multiple sources (npm packages, node_modules, monorepo structure), caching strategies, and comprehensive error handling for missing or malformed adapter packages
- **AdapterRegistry** (`adapter-registry.test.ts`): Validates centralized adapter registration, factory validation, instance lifecycle management, automatic disposal mechanisms, and dynamic loading coordination

### Adapter Implementation Tests
- **MockDebugAdapter** (`mock-debug-adapter.test.ts`): Tests mock adapter functionality including state transitions, feature support validation, error translation, and error scenario injection for testing purposes
- **JavascriptDebugAdapter** (`javascript-debug-adapter.test.ts`): Validates JavaScript-specific debugging features, error message translation for Node.js runtime issues, and launch coordination barriers
- **JsDebugLaunchBarrier** (`js-debug-launch-barrier.test.ts`): Tests launch readiness detection utility for JavaScript debugging, including DAP event synchronization and timeout handling

## Key Testing Patterns

### Mock Infrastructure
- **Standardized Mock Factories**: Consistent adapter and factory mocking across test suites
- **Dependency Injection**: Mock logger, filesystem, environment, and network dependencies
- **Event-Driven Testing**: Validation of adapter lifecycle events and state transitions

### Error Handling Validation
- **Module Loading Errors**: Tests for missing packages, invalid factory classes, and network issues
- **Runtime Errors**: Validation of error translation and user-friendly messaging
- **Timeout and Cleanup**: Ensures proper resource disposal and timeout handling

### Dynamic Loading Coverage
- **Multi-Path Resolution**: Tests npm packages, node_modules, and monorepo fallback strategies
- **Caching Behavior**: Validates adapter instance and availability caching
- **Registry Integration**: Tests coordination between loader and registry components

## Public API Surface Tested

### AdapterLoader Interface
- `loadAdapter(language)`: Dynamic adapter loading with fallback mechanisms
- `isAdapterAvailable(language)`: Availability checking with caching
- `listAvailableAdapters()`: Metadata discovery for all known adapters

### AdapterRegistry Interface  
- `register(factory)`: Factory registration with validation
- `createAdapter(language, config)`: Instance creation with lifecycle management
- `disposeAll()`: Bulk cleanup operations

### Adapter Implementation Interface
- `initialize()`, `connect()`, `disconnect()`: Lifecycle management
- `supportsFeature(feature)`: Feature capability reporting  
- `translateErrorMessage(error)`: User-friendly error translation
- `createLaunchBarrier()`: Launch coordination utilities

## Internal Organization

### Test Utilities
- Mock factories for adapters, dependencies, and logging infrastructure
- Shared patterns for state validation and error scenario testing
- Timer-based testing for timeout and auto-disposal mechanisms

### Coverage Areas
- **Adapter Discovery**: Package resolution across multiple installation patterns
- **Lifecycle Management**: Registration, creation, disposal, and cleanup
- **Error Scenarios**: Missing runtimes, invalid configurations, network failures
- **Feature Support**: Debugging capabilities like breakpoints, evaluation, logging
- **Performance**: Caching strategies and resource optimization

### Dependencies
- **Vitest Framework**: Comprehensive mocking, fake timers, and assertion utilities
- **@debugmcp/shared**: Common types, enums, and error classes
- **Adapter Packages**: Mock, JavaScript, and other language-specific adapters

This test directory ensures the adapter system's reliability, proper error handling, and consistent behavior across different adapter implementations and deployment scenarios.
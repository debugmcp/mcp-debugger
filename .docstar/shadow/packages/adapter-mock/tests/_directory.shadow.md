# packages\adapter-mock\tests/
@children-hash: 4c4c9bb9ac67a721
@generated: 2026-02-15T09:01:32Z

## Purpose and Responsibility
This directory contains the complete test suite for the mock debug adapter package, providing comprehensive validation of both the factory pattern implementation and the core mock debug adapter functionality. The tests ensure the mock adapter can serve as a reliable testing and development tool within the broader debug adapter ecosystem.

## Key Components and Relationships

**Integration Tests (`mock-adapter.test.ts`)**
- Validates package-level exports and basic integration
- Tests that `MockAdapterFactory` and `MockDebugAdapter` are properly exported
- Verifies factory pattern functionality for creating adapter instances
- Serves as smoke tests for the overall package integrity

**Unit Tests Directory (`unit/`)**
- **`mock-adapter-factory.test.ts`**: Comprehensive testing of the factory pattern implementation
  - Validates factory instantiation, configuration, and metadata generation
  - Tests configuration warning system for performance parameters
  - Covers the convenience helper `createMockAdapterFactory()` function
- **`mock-debug-adapter.spec.ts`**: Core adapter functionality testing
  - Tests complete adapter lifecycle and state management
  - Validates DAP (Debug Adapter Protocol) event handling
  - Tests error scenario simulation and feature support configuration

## Public API Surface Testing Coverage

**Factory Layer:**
- `MockAdapterFactory` constructor and configuration validation
- `createMockAdapterFactory()` helper function
- Metadata generation (language type, display name, version, extensions)

**Adapter Layer:**
- Lifecycle methods: `initialize()`, `connect()`, `disconnect()`
- Protocol handling: `handleDapEvent()` for DAP events
- Feature management: `supportsFeature()` and `getFeatureRequirements()`

## Internal Organization and Data Flow

**Test Architecture:**
1. **Dependency Mocking**: Uses `createDependencies()` helper to create mock `AdapterDependencies` with stubbed interfaces
2. **State Validation**: Event-driven testing for adapter state transitions (INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED)
3. **Error Scenario Testing**: Systematic validation using `MockErrorScenario` enum for failure conditions
4. **Configuration Testing**: Validates both successful configuration and warning generation

**Testing Patterns:**
- **Isolation Strategy**: Vitest spy functions for logger mocking and dependency isolation
- **Async Patterns**: Proper async/await testing for adapter lifecycle methods
- **Type Safety**: TypeScript casting for mock objects while maintaining type safety
- **Performance Validation**: Threshold-based warning system testing for configuration parameters

## Important Testing Conventions

- **Minimal Integration Testing**: Basic package export validation focusing on integration rather than detailed functionality
- **Comprehensive Unit Testing**: Detailed validation of factory patterns, adapter lifecycle, and error handling
- **Mock Strategy**: Consistent use of dependency injection and mocking for reliable test execution
- **State-Driven Testing**: Event-based validation ensuring proper adapter state management and DAP protocol compliance

This test suite ensures the mock adapter provides predictable, configurable behavior for development workflows and integration testing within the debug adapter framework ecosystem.
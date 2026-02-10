# packages/adapter-mock/tests/unit/
@generated: 2026-02-09T18:16:04Z

## Purpose
This directory contains the unit test suite for the `@debugmcp/adapter-mock` package, providing comprehensive validation of the mock debug adapter implementation. The tests ensure proper factory pattern implementation, adapter lifecycle management, DAP (Debug Adapter Protocol) event handling, and error scenario simulation for debugger testing frameworks.

## Key Components and Relationships

### Test Structure
- **MockAdapterFactory tests** (`mock-adapter-factory.test.ts`): Validates the factory pattern implementation for creating mock debug adapters
- **MockDebugAdapter tests** (`mock-debug-adapter.spec.ts`): Comprehensive behavioral testing of the actual mock adapter implementation

### Shared Testing Infrastructure
Both test files utilize a common pattern with:
- **Mock dependency factories**: `createDependencies()` functions that provide stubbed implementations of `AdapterDependencies` (fileSystem, processLauncher, environment, logger)
- **Vitest framework**: Standard testing structure using `describe`, `it`, `expect`, and `beforeEach`
- **Common imports**: Shared types from `@debugmcp/shared` for consistent testing interfaces

## Test Coverage Areas

### Factory Pattern Validation
- Factory instance creation and metadata validation
- Configuration validation and warning system
- Convenience function behavior verification

### Adapter Lifecycle Management
- State transitions (INITIALIZING → READY → CONNECTED → DEBUGGING)
- Connection and disconnection flows with proper cleanup
- Error state handling and recovery

### DAP Protocol Compliance
- Event processing for standard DAP events ('stopped', 'terminated')
- Thread ID management during debugging sessions
- Feature support detection and requirement reporting

### Error Scenario Testing
- Configurable error simulation through MockErrorScenario
- Error message translation and user guidance
- Connection timeout and executable missing scenarios

## Public API Surface
The test suite validates the following public interfaces:
- **MockAdapterFactory**: Factory class with `create()` method and metadata properties
- **createMockAdapterFactory()**: Convenience function for factory instantiation
- **MockDebugAdapter**: Main adapter class with standard debugger lifecycle methods
- **Configuration interfaces**: Error probability, delay settings, and feature configuration

## Testing Patterns and Conventions
- **Dependency injection**: All tests use mocked dependencies for isolation
- **State tracking**: Event-driven testing with state transition verification  
- **Async testing**: Proper handling of adapter lifecycle promises
- **Error simulation**: Controlled error scenario testing for robustness validation
- **Contract validation**: Focus on interface compliance rather than implementation details

This test suite serves as both validation and documentation of the expected behavior for mock debug adapters in the larger debugger testing ecosystem.
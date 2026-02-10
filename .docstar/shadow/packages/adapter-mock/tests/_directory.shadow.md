# packages/adapter-mock/tests/
@generated: 2026-02-09T18:16:18Z

## Purpose
This directory contains the comprehensive test suite for the `@debugmcp/adapter-mock` package, providing validation and behavioral verification of the mock debug adapter implementation. The tests ensure the mock adapter properly implements the Debug Adapter Protocol (DAP) and can effectively simulate various debugging scenarios for testing debugger frameworks and tools.

## Component Organization

### Test Structure Hierarchy
- **Integration tests** (`mock-adapter.test.ts`): Basic smoke tests validating package exports and factory instantiation
- **Unit tests** (`unit/` directory): Comprehensive behavioral testing with two main test suites:
  - **Factory tests** (`mock-adapter-factory.test.ts`): Validates the factory pattern implementation and metadata
  - **Adapter tests** (`mock-debug-adapter.spec.ts`): Deep behavioral testing of the mock adapter functionality

### Shared Testing Infrastructure
All tests utilize consistent patterns including:
- **Mock dependency injection**: `createDependencies()` functions providing stubbed implementations of core services (fileSystem, processLauncher, environment, logger)
- **Vitest framework**: Standardized test structure with `describe`, `it`, `expect`, and lifecycle hooks
- **Common type imports**: Shared interfaces from `@debugmcp/shared` ensuring consistent testing contracts

## Key Test Coverage Areas

### Package Integration Validation
- Export verification for `MockAdapterFactory` and `MockDebugAdapter` classes
- Factory pattern implementation and instantiation correctness
- Package entry point accessibility and type safety

### Adapter Lifecycle Management
- State transition validation (INITIALIZING → READY → CONNECTED → DEBUGGING)
- Connection establishment and cleanup procedures
- Error state handling and recovery mechanisms
- Async operation management and promise resolution

### DAP Protocol Compliance
- Event processing for standard DAP events ('stopped', 'terminated', etc.)
- Thread ID management during debugging sessions
- Feature support detection and requirement reporting
- Protocol message handling and response generation

### Error Simulation and Robustness
- Configurable error scenario testing through `MockErrorScenario`
- Connection timeout and failure mode validation
- Error message translation and user guidance verification
- Edge case handling for missing executables and configuration issues

## Public API Validation
The test suite validates the complete public interface surface:
- **MockAdapterFactory**: Factory class with metadata properties and `create()` method
- **createMockAdapterFactory()**: Convenience function for simplified factory instantiation
- **MockDebugAdapter**: Main adapter implementation with full DAP lifecycle support
- **Configuration interfaces**: Error probability settings, timing delays, and feature toggles

## Testing Patterns and Conventions
- **Dependency isolation**: All tests use mocked dependencies to ensure unit-level testing
- **State-driven validation**: Event-driven testing with explicit state transition verification
- **Async pattern testing**: Proper handling of adapter lifecycle promises and timing
- **Contract-first approach**: Focus on interface compliance and behavioral contracts rather than implementation details
- **Error scenario coverage**: Systematic testing of failure modes and error recovery paths

This test directory serves as both a validation suite and living documentation of the expected behavior for mock debug adapters, ensuring they can effectively simulate real debugging scenarios while maintaining DAP compliance within the larger debugger testing ecosystem.
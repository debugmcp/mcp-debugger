# packages/adapter-mock/tests/
@generated: 2026-02-11T23:47:52Z

## Purpose

This directory contains the comprehensive test suite for the mock debug adapter package, providing validation coverage for both the adapter implementation and its factory pattern. The tests ensure the mock adapter properly implements the Debug Adapter Protocol (DAP) while serving as a reliable test double for development and testing scenarios.

## Overall Architecture

The test suite is organized into two complementary layers:

### Integration Tests (`mock-adapter.test.ts`)
- **Package Export Validation**: Ensures `MockAdapterFactory` and `MockDebugAdapter` are properly exported from the package index
- **Basic Factory Integration**: Validates the factory can instantiate adapter instances with proper type checking
- **Smoke Tests**: Provides minimal coverage focusing on package-level integration

### Comprehensive Unit Tests (`unit/` directory)
- **Factory Testing**: Deep validation of `MockAdapterFactory` including configuration, metadata, and validation logic
- **Adapter Implementation**: Complete lifecycle testing of `MockDebugAdapter` with state management, error scenarios, and DAP event handling
- **Mock Infrastructure**: Shared dependency mocking patterns for isolated testing

## Key Components and Relationships

### Test Structure Flow
1. **Package-level exports** are validated for basic availability and instantiation
2. **Factory functionality** is tested for proper adapter creation and configuration validation
3. **Adapter lifecycle** is thoroughly tested including state transitions (INITIALIZING → READY → CONNECTED → DEBUGGING)
4. **Error scenarios** are validated through configurable error injection using `MockErrorScenario`
5. **DAP compliance** is verified through event handling ('stopped', 'terminated') and feature support

### Common Testing Patterns
- **Mock Dependencies**: Shared `createDependencies()` functions create isolated test environments with stubbed file system, process launcher, environment, and logger interfaces
- **State Transition Validation**: Event listeners track adapter state changes throughout lifecycle operations
- **Spy Integration**: Vitest spy functions enable logger validation and method call tracking
- **Async/Await Patterns**: Proper handling of adapter lifecycle methods and event processing

## Public API Coverage

The test suite validates the complete public interface:

### Factory Interface
- `MockAdapterFactory` constructor with configuration options (supportedFeatures, defaultDelay)
- `createMockAdapterFactory` convenience helper function
- Metadata reporting (language type, display name, version, file extensions)
- Configuration validation with warnings for problematic settings

### Adapter Interface
- Standard debug adapter lifecycle methods (initialize, connect, disconnect)
- State management and transition events
- DAP event processing and handling
- Feature support querying and dynamic configuration
- Error scenario simulation for negative testing

## Integration with Broader System

This test directory ensures the mock adapter maintains compatibility with the shared debug adapter interfaces from `@debugmcp/shared`, validating that it can serve as a drop-in replacement for real adapters during development and testing. The comprehensive coverage provides confidence that the mock adapter behaves predictably while supporting configurable error scenarios for robust testing of dependent systems.

## Test Infrastructure Benefits

The test suite establishes patterns for:
- **Dependency Injection**: Clean separation of concerns through mock dependencies
- **Error Simulation**: Configurable failure modes for comprehensive negative testing
- **State Validation**: Event-driven testing of complex state transitions
- **Feature Testing**: Dynamic capability validation and requirements checking
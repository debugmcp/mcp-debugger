# packages/adapter-mock/tests/
@generated: 2026-02-10T21:26:30Z

## Purpose & Responsibility

This directory contains the complete test suite for the MockAdapter package, providing comprehensive validation of the mock debugging infrastructure used throughout the debug adapter ecosystem. The tests ensure the mock adapter properly implements the standard debug adapter interface while providing configurable behavior for development, testing, and demonstration scenarios.

## Directory Organization

The test suite is organized in two layers:

- **Root level tests** (`mock-adapter.test.ts`): Integration tests validating package exports and basic factory functionality
- **Unit test directory** (`unit/`): Comprehensive unit tests covering detailed adapter and factory behavior

## Key Test Components

### Integration Layer
- **Package Export Validation**: Ensures `MockAdapterFactory` and `MockDebugAdapter` are properly exported and accessible
- **Factory Integration**: Validates the factory pattern can create adapter instances with correct typing

### Unit Test Layer
- **`mock-debug-adapter.spec.ts`**: Complete adapter lifecycle testing including initialization, connection management, DAP event handling, state transitions, thread tracking, and configurable error simulation
- **`mock-adapter-factory.test.ts`**: Factory pattern validation covering adapter creation, metadata exposure, configuration validation, and warning systems

## Public API Test Coverage

### MockDebugAdapter Interface
- **Lifecycle Management**: `initialize()`, `connect()`, `disconnect()` with state transition validation
- **Protocol Handling**: `handleDapEvent()` for Debug Adapter Protocol events
- **Feature Support**: `supportsFeature()`, `getFeatureRequirements()` with configurable capabilities
- **Error Management**: Installation instruction mapping and filesystem error translation
- **State Tracking**: INITIALIZING → READY → CONNECTED → DEBUGGING state machine validation

### MockAdapterFactory Interface
- **Adapter Creation**: Custom configuration support (supportedFeatures, defaultDelay, errorProbability)
- **Metadata API**: Language type, display name, version, and file extension information
- **Configuration Validation**: Warning system for performance threshold violations
- **Convenience Methods**: `createMockAdapterFactory()` helper function testing

## Test Infrastructure & Patterns

### Shared Testing Utilities
- **Dependency Injection**: `createDependencies()` pattern providing consistent mock objects for file system, process launcher, environment, and logger interfaces
- **State Transition Testing**: Event-driven validation using async/await patterns and event listeners
- **Error Scenario Simulation**: MockErrorScenario enumeration for testing various failure conditions

### Quality Assurance Patterns
- **Boundary Testing**: Configuration validation warnings for errorProbability > 0.8 and defaultDelay > 2500ms
- **Interface Compliance**: Type satisfaction testing ensuring proper adapter interface implementation
- **Error Coverage**: Connection timeouts, executable not found, and configuration validation scenarios

## Integration with Debug Adapter Ecosystem

The tests validate seamless integration with the broader debug adapter system through shared types from `@debugmcp/shared`, including AdapterDependencies, DebugFeature, DebugLanguage, AdapterState, and AdapterErrorCode. This ensures the mock adapter serves as a reliable testing and development tool while maintaining full compatibility with the standard debug adapter protocol.

## Test Entry Points

Primary test execution flows through:
1. **Package-level validation** via root test file
2. **Detailed functionality testing** via unit test suite
3. **Factory pattern verification** ensuring proper adapter instantiation and configuration
4. **Protocol compliance testing** validating DAP event handling and state management
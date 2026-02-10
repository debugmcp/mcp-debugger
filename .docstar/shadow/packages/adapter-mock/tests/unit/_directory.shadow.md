# packages/adapter-mock/tests/unit/
@generated: 2026-02-10T01:19:36Z

## Mock Debug Adapter Unit Test Suite

**Purpose:** Comprehensive unit testing module for the MockDebugAdapter implementation and its factory. This directory contains thorough test coverage validating the mock debug adapter's lifecycle management, error simulation capabilities, and configuration validation.

**Key Components & Organization:**

### Test Files Structure
- **`mock-adapter-factory.test.ts`:** Tests for MockAdapterFactory class and helper functions, focusing on adapter creation, configuration validation, and metadata handling
- **`mock-debug-adapter.spec.ts`:** Core adapter implementation tests covering initialization, connection management, DAP event handling, and error scenarios

### Shared Test Utilities
- **`createDependencies()` Helper:** Common utility function appearing in both test files that creates mock AdapterDependencies with stubbed file system, process launcher, environment, and logger interfaces
- **Mock Spy Integration:** Uses Vitest spy functions for logger mocking and dependency injection

### Testing Scope & Coverage

**Factory Testing:**
- Adapter instantiation with custom configurations (supportedFeatures, defaultDelay)
- Metadata validation (language type, display name, version, file extensions)
- Configuration validation warnings for high error probability and excessive delays
- Convenience factory function validation

**Adapter Lifecycle Testing:**
- State transition validation: INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED
- Connection management with timeout handling
- Thread ID tracking and cleanup
- Event emission and listener validation

**Error Scenario Simulation:**
- MockErrorScenario integration for testing failure modes
- Connection timeout errors with proper error code matching
- Executable not found scenarios
- Error message translation and formatting

### Data Flow Patterns

1. **Test Setup:** Each test creates mock dependencies using shared utility functions
2. **Adapter Creation:** Factory or direct instantiation with test-specific configurations
3. **State Monitoring:** Event listeners track state transitions and validate expected behavior
4. **Error Injection:** MockErrorScenario enum values simulate specific failure conditions
5. **Assertion Validation:** Tests verify correct state, event emission, and error handling

### Public API Testing Surface

- **MockAdapterFactory:** Constructor validation, metadata retrieval, configuration validation
- **createMockAdapterFactory:** Helper function for simplified factory creation
- **MockDebugAdapter:** Core lifecycle methods (initialize, connect, disconnect, handleDapEvent)
- **Feature Support:** supportsFeature() and getFeatureRequirements() method validation
- **Error Handling:** Installation instructions, missing executable, and filesystem error translation

### Testing Conventions

- Async/await patterns for adapter lifecycle method testing
- Object type casting for dependency mocking isolation
- State transition validation through event listeners
- Configuration-driven test scenarios (error probabilities, delays, feature flags)
- Mock dependency injection for isolated unit testing

This test suite ensures the MockDebugAdapter provides reliable debugging simulation capabilities while maintaining proper adapter interface compliance and error handling patterns.
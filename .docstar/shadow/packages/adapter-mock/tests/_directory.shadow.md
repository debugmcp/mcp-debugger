# packages/adapter-mock/tests/
@generated: 2026-02-10T01:19:49Z

## Test Suite for Mock Debug Adapter

**Purpose:** This directory contains comprehensive test coverage for the mock debug adapter package, validating both the external package interface and internal implementation details. The tests ensure the mock adapter properly simulates debugging scenarios while maintaining compatibility with the debug adapter protocol.

## Test Organization & Coverage

### Integration Tests (`mock-adapter.test.ts`)
- **Package Export Validation:** Verifies that `MockAdapterFactory` and `MockDebugAdapter` are properly exported from the package index
- **Factory Integration:** Tests basic factory instantiation and adapter creation workflow
- **Entry Point Validation:** Ensures the package public API is accessible and functional

### Comprehensive Unit Tests (`unit/` directory)
- **Factory Testing (`mock-adapter-factory.test.ts`):** Validates adapter creation, configuration validation, metadata handling, and convenience factory functions
- **Core Implementation Testing (`mock-debug-adapter.spec.ts`):** Thorough coverage of adapter lifecycle, state transitions, DAP event handling, and error simulation

## Key Testing Components

### Shared Test Infrastructure
- **`createDependencies()` Utility:** Common mock dependency factory providing stubbed interfaces for file system, process launcher, environment, and logger
- **Vitest Framework Integration:** Modern testing setup with spy functions and async test support
- **Mock Dependency Injection:** Isolated testing through dependency abstraction

### Testing Patterns & Data Flow

1. **Layered Testing Approach:**
   - Integration level: Package exports and basic functionality
   - Unit level: Detailed implementation and edge cases

2. **State Transition Validation:**
   - Tests cover complete adapter lifecycle: INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED
   - Event emission tracking and listener validation

3. **Error Scenario Testing:**
   - MockErrorScenario integration for failure mode simulation
   - Connection timeouts, missing executables, and filesystem errors
   - Proper error code matching and message translation

4. **Configuration-Driven Testing:**
   - Custom feature support validation
   - Error probability and delay configuration testing
   - Configuration validation warnings

## Public API Testing Coverage

### Main Entry Points
- **MockAdapterFactory:** Constructor, metadata retrieval, configuration validation
- **createMockAdapterFactory:** Simplified factory creation helper
- **MockDebugAdapter:** Core lifecycle methods and DAP protocol handling

### Key Capabilities Tested
- **Feature Support:** `supportsFeature()` and `getFeatureRequirements()` validation
- **Connection Management:** Timeout handling and thread ID tracking
- **Error Handling:** Installation instructions and error translation
- **Event System:** Proper DAP event emission and state change notifications

## Testing Conventions

The test suite follows consistent patterns for dependency mocking, async operation testing, and state validation. Tests use object type casting for isolation, configuration-driven scenarios for comprehensive coverage, and event listeners for state transition verification. This ensures the mock adapter provides reliable debugging simulation while maintaining proper adapter interface compliance.
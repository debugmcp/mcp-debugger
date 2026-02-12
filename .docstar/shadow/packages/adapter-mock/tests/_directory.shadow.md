# packages\adapter-mock\tests/
@generated: 2026-02-12T21:01:05Z

## Mock Adapter Test Suite

**Purpose:** Comprehensive test directory for the Mock Debug Adapter package, providing validation coverage from integration-level package exports through detailed unit testing of factory patterns and core adapter functionality.

**Test Architecture:**

### Integration Testing (`mock-adapter.test.ts`)
- **Package Export Validation:** Verifies proper public API exposure of `MockAdapterFactory` and `MockDebugAdapter` classes
- **Basic Factory Integration:** Tests end-to-end factory instantiation and adapter creation
- **Smoke Testing:** Minimal coverage ensuring basic package functionality and type correctness

### Unit Testing (`unit/` subdirectory)
- **Factory Testing (`mock-adapter-factory.test.ts`):** Comprehensive validation of factory creation, configuration handling, metadata generation, and validation logic
- **Core Adapter Testing (`mock-debug-adapter.spec.ts`):** Detailed testing of adapter lifecycle, state management, DAP event processing, and feature support

**Public API Test Coverage:**

### Entry Points Tested
- `MockAdapterFactory` constructor and configuration validation
- `createMockAdapterFactory()` helper function for simplified factory creation
- `MockDebugAdapter` core lifecycle methods: `initialize()`, `connect()`, `disconnect()`
- Debug event handling through `handleDapEvent()` method
- Feature support querying via `supportsFeature()` and `getFeatureRequirements()`

### Key Test Scenarios
1. **Configuration Validation:** Tests factory settings including feature flags, delays, and error probabilities with warning generation
2. **State Management:** Validates proper adapter state transitions (INITIALIZING → READY) and error handling
3. **Connection Lifecycle:** Tests connect/disconnect cycles with timeout and error scenarios
4. **DAP Protocol Support:** Validates debug event processing ('stopped', 'terminated') with proper thread tracking
5. **Error Translation:** Tests mock-specific error messaging and installation instructions

**Testing Patterns & Utilities:**

### Shared Infrastructure
- **Mock Dependencies:** `createDependencies()` helper provides isolated test environment with spy loggers
- **Event-Driven Validation:** State transition testing through event listeners
- **Error Simulation:** Configurable mock behaviors using MockErrorScenario patterns
- **Type Safety:** Strategic type casting for mock object creation

### Testing Framework Integration
- **Vitest Framework:** Primary testing infrastructure with spy utilities and assertions
- **Async/Await Patterns:** Proper handling of adapter lifecycle asynchronous operations
- **Mock Dependency Injection:** Isolated unit testing through dependency abstraction

**Test Data Flow:**
1. Integration tests validate public package interface and basic factory functionality
2. Unit tests drill down into factory configuration, validation logic, and adapter behavior
3. Both levels ensure proper error handling, state management, and DAP protocol compliance
4. Shared utilities enable consistent testing patterns across all test files

This test suite provides comprehensive coverage ensuring the mock adapter implementation serves as a reliable foundation for development workflows, debugging scenarios, and integration testing of the broader debug adapter protocol system.
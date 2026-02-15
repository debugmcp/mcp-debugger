# packages\adapter-mock\tests\unit/
@children-hash: 6f7bce74ea39f2ab
@generated: 2026-02-15T09:01:20Z

## Mock Adapter Unit Tests Directory

**Overall Purpose:** Comprehensive unit test suite for the mock debug adapter implementation, providing validation of both the adapter factory pattern and the core mock debug adapter functionality. These tests ensure proper behavior of the mock adapter's lifecycle, configuration, error handling, and integration with the debug adapter framework.

**Key Components & Relationships:**

- **`mock-adapter-factory.test.ts`:** Tests the factory pattern implementation for creating mock debug adapters
  - Validates `MockAdapterFactory` class instantiation and configuration
  - Tests metadata generation (language type, display name, version, extensions)
  - Validates configuration warnings for performance parameters (errorProbability, defaultDelay)
  - Tests the convenience helper `createMockAdapterFactory()` function

- **`mock-debug-adapter.spec.ts`:** Comprehensive testing of the core `MockDebugAdapter` implementation
  - Tests adapter lifecycle: initialization, connection management, debugging states
  - Validates DAP (Debug Adapter Protocol) event handling and state transitions
  - Tests error scenario simulation and proper error code propagation
  - Validates feature support configuration and reporting

**Public API Coverage:**

- **Factory Creation:** `MockAdapterFactory` constructor and `createMockAdapterFactory()` helper
- **Adapter Lifecycle:** `initialize()`, `connect()`, `disconnect()` methods
- **Event Handling:** `handleDapEvent()` for DAP protocol events
- **Feature Support:** `supportsFeature()` and `getFeatureRequirements()` methods
- **Configuration Validation:** Factory validation with warning generation for performance parameters

**Internal Organization & Data Flow:**

1. **Dependency Mocking:** Both test files use `createDependencies()` helper to create mock `AdapterDependencies` with stubbed file system, process launcher, environment, and logger interfaces
2. **State Management Testing:** Validates proper state transitions (INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED)
3. **Error Scenario Testing:** Uses `MockErrorScenario` enum to simulate various failure conditions
4. **Configuration Testing:** Validates both successful configuration and warning generation for edge cases

**Important Patterns & Conventions:**

- **Mock Strategy:** Uses Vitest spy functions for logger mocking and dependency isolation
- **State Validation:** Event-driven testing pattern for adapter state transitions
- **Error Testing:** Systematic validation of error scenarios using predefined error types
- **Type Safety:** Leverages TypeScript casting for mock object creation while maintaining type safety
- **Async Testing:** Proper async/await patterns for testing adapter lifecycle methods
- **Configuration Warnings:** Tests threshold-based warning system for performance-related configuration values

This test suite ensures the mock adapter can serve as a reliable testing and development tool within the broader debug adapter ecosystem, providing predictable behavior for integration testing and development workflows.
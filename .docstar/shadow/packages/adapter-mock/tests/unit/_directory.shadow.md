# packages\adapter-mock\tests\unit/
@generated: 2026-02-12T21:05:42Z

## Unit Test Suite for Mock Debug Adapter

**Purpose:** This directory contains comprehensive unit tests for the mock debug adapter implementation, validating both the factory pattern for adapter creation and the core adapter functionality. The tests ensure proper behavior of the mock adapter used for testing and development scenarios in the debug MCP system.

**Key Components:**

### Test Structure & Organization

- **Factory Tests (`mock-adapter-factory.test.ts`):** Validates the MockAdapterFactory class and its helper functions, focusing on configuration handling, metadata generation, and validation logic
- **Adapter Tests (`mock-debug-adapter.spec.ts`):** Comprehensive testing of the MockDebugAdapter implementation covering lifecycle management, state transitions, and error scenarios

### Core Testing Areas

**Configuration & Factory Pattern:**
- Tests adapter factory instantiation with custom configurations (supportedFeatures, defaultDelay)
- Validates metadata generation (language type, display name, version, extensions)
- Verifies configuration validation with warning generation for high error probabilities and excessive delays

**Adapter Lifecycle Management:**
- State transition validation (INITIALIZING → READY → CONNECTED → DEBUGGING)
- Connection/disconnection flow testing with proper cleanup
- Thread ID tracking and context management
- Event emission and listener integration

**Error Scenario Simulation:**
- Mock error scenario handling (executable not found, connection timeouts)
- Error code translation and message formatting
- State management during error conditions

### Test Utilities & Patterns

**Common Infrastructure:**
- `createDependencies()` helper functions in both files create mock AdapterDependencies with spy loggers
- Consistent mocking patterns using Vitest framework
- Object type casting for dependency injection (`{} as unknown`)

**Testing Approaches:**
- State-driven testing through event listeners
- Async/await patterns for lifecycle method validation
- Error scenario simulation using `MockErrorScenario` enum
- Feature support validation against configuration flags

### Dependencies & Integration

**External Dependencies:**
- **Vitest:** Test framework providing spy functions and assertion utilities
- **@debugmcp/shared:** Core types and interfaces (AdapterDependencies, DebugFeature, AdapterState, etc.)

**Internal Components:**
- MockAdapterFactory and MockDebugAdapter from source modules
- Shared test utilities for consistent dependency mocking

### Public API Testing Surface

The tests validate the public interface of:
- `MockAdapterFactory` constructor and factory methods
- `createMockAdapterFactory()` helper function
- `MockDebugAdapter` lifecycle methods (initialize, connect, disconnect)
- Feature support and configuration validation APIs
- Error handling and state management interfaces

This test suite ensures the mock adapter provides reliable testing infrastructure for the broader debug MCP system while maintaining proper adherence to the adapter interface contracts.
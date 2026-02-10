# packages/adapter-mock/tests/unit/mock-debug-adapter.spec.ts
@source-hash: c7dab162d8bcf604
@generated: 2026-02-10T01:18:53Z

**Mock Debug Adapter Test Suite**

This test file comprehensively validates the MockDebugAdapter implementation, covering initialization, connection management, error scenarios, and feature support.

## Test Utilities & Setup

- `createDependencies()` (L6-22): Factory function creating mock AdapterDependencies with spy logger functions for testing
- Test setup (L27-29): Resets mock dependencies before each test

## Core Functionality Tests

**Initialization & State Management** (L31-50):
- Tests successful initialization flow: INITIALIZING → READY state transitions
- Validates error scenario handling when `MockErrorScenario.EXECUTABLE_NOT_FOUND` is set
- Verifies state event emission and error state transitions

**Connection Management** (L52-77):
- Tests connect/disconnect cycle with state transitions: READY → CONNECTED → DISCONNECTED
- Validates connection flags and thread ID reset on disconnect
- Tests connection timeout error scenario with proper error code matching

**DAP Event Handling** (L79-97):
- Tests `handleDapEvent()` method with 'stopped' and 'terminated' events
- Validates thread ID tracking (threadId: 42) and state transitions (CONNECTED → DEBUGGING → CONNECTED)
- Ensures proper cleanup of thread context on termination

**Feature Support & Configuration** (L99-110):
- Tests feature support reporting based on `supportedFeatures` configuration
- Validates `supportsFeature()` method for enabled/disabled features
- Tests `getFeatureRequirements()` method return structure

**Error Translation & Messaging** (L112-117):
- Tests installation instructions, missing executable errors, and filesystem error translation
- Validates mock-specific error message formatting

## Key Dependencies

- **vitest**: Test framework with spy functions for logger mocking
- **@debugmcp/shared**: Core types (DebugFeature, AdapterState, AdapterErrorCode, AdapterDependencies)
- **MockDebugAdapter**: Primary test subject with configurable error scenarios

## Test Patterns

- State transition validation through event listeners
- Error scenario simulation using `MockErrorScenario` enum
- Async/await patterns for adapter lifecycle methods
- Mock dependency injection for isolated testing
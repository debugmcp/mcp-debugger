# tests/unit/adapters/mock-debug-adapter.test.ts
@source-hash: 113a632b946b93aa
@generated: 2026-02-09T18:14:37Z

## Purpose
Unit test suite for MockDebugAdapter, validating core functionality including state transitions, feature support configuration, error handling, and error scenario simulation.

## Key Test Structure
- **Test Setup (L5-16)**: `createDependencies()` factory creates mock AdapterDependencies with stubbed logger and empty service objects
- **Test Fixture (L21-27)**: `beforeEach` initializes MockDebugAdapter with conditional breakpoints and log points enabled, zero connection delay
- **State Transition Test (L29-38)**: Validates adapter progresses through READY → CONNECTED → DISCONNECTED states via initialize/connect/disconnect operations
- **Feature Support Test (L40-43)**: Verifies adapter correctly reports configured feature capabilities (conditional breakpoints enabled, data breakpoints disabled)
- **Error Translation Test (L45-48)**: Tests adapter's ability to convert filesystem ENOENT errors into user-friendly messages
- **Error Scenario Test (L50-53)**: Validates configured error scenarios (CONNECTION_TIMEOUT) properly trigger during connect operations

## Dependencies
- **Testing Framework**: Vitest for test runner, mocking, and assertions
- **Test Target**: MockDebugAdapter from adapter-mock package
- **Shared Types**: AdapterState, DebugFeature, AdapterDependencies from @debugmcp/shared

## Test Patterns
- Mock-heavy approach with stubbed dependencies to isolate adapter logic
- State-based testing validating adapter lifecycle transitions
- Configuration-driven testing of feature support and error scenarios
- Error handling validation ensuring proper message translation

## Coverage Focus
Tests core adapter contract compliance: initialization, connection management, feature reporting, and error handling without external dependencies.
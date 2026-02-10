# tests/unit/adapters/mock-debug-adapter.test.ts
@source-hash: 113a632b946b93aa
@generated: 2026-02-10T00:41:29Z

## Purpose
Unit test suite for MockDebugAdapter class, validating core debugging adapter behaviors including state transitions, feature support, error handling, and mock error scenario injection.

## Test Structure
**Main describe block** (L18-54): "MockDebugAdapter behaviour" - comprehensive behavioral testing

**Test setup** (L21-27):
- `createDependencies()` (L5-16): Factory function creating mock AdapterDependencies with vitest spies for logger and empty objects for other services
- `beforeEach` hook initializes fresh adapter instance with conditional breakpoints and log points support, zero connection delay

## Key Test Cases

**State transition test** (L29-38):
- Verifies adapter progresses through READY → CONNECTED → DISCONNECTED states
- Tests `initialize()`, `connect()`, and `disconnect()` methods
- Validates state management via `getState()`

**Feature support test** (L40-43):
- Confirms adapter correctly reports configured feature support
- Tests `supportsFeature()` method against configured and unconfigured features

**Error translation test** (L45-48):
- Validates error message transformation for filesystem errors
- Tests `translateErrorMessage()` method with ENOENT scenario

**Error scenario injection test** (L50-53):
- Verifies mock error scenario system functionality
- Tests `setErrorScenario()` and connection failure simulation with CONNECTION_TIMEOUT

## Dependencies
- **vitest**: Testing framework providing describe/it/expect/beforeEach/vi
- **MockDebugAdapter & MockErrorScenario**: Core classes under test from adapter-mock package
- **@debugmcp/shared**: Provides AdapterState, DebugFeature enums and AdapterDependencies type

## Test Configuration
Adapter configured with:
- Supported features: CONDITIONAL_BREAKPOINTS, LOG_POINTS
- Connection delay: 0ms (immediate for testing)
- Mock dependencies with spied logger methods
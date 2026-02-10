# packages/adapter-javascript/tests/unit/javascript-debug-adapter.lifecycle.edge.test.ts
@source-hash: abc1a5259b664feb
@generated: 2026-02-10T00:41:08Z

**Test Suite: JavascriptDebugAdapter Edge Case Lifecycle Tests**

This test file validates edge case behaviors in the JavascriptDebugAdapter lifecycle, specifically initialization warning handling and dispose cache clearing functionality.

## Dependencies & Setup
- **Test Framework**: Vitest with mock capabilities (L1)
- **Core Subject**: JavascriptDebugAdapter from adapter package (L3)
- **Mock Dependencies**: Stubbed AdapterDependencies with logger (L8-15)
- **External Mock**: executable-resolver.findNode function (L5)

## Test Structure
**Mock Setup** (L18-21): Restores and clears all mocks before each test to ensure isolation.

**Test Case 1: Warning Logging During Initialization** (L23-44)
- Validates that initialization warnings are logged exactly once each
- Mocks validateEnvironment to return specific warnings (L28-32)
- Verifies state transition to READY and 'initialized' event emission
- Asserts precise call counts and message ordering for logger.warn

**Test Case 2: Cache Clearing on Dispose** (L46-71)
- Tests that dispose() properly clears internal caches
- Uses resolveExecutablePath() as cache validation mechanism
- Mocks findNode to track call frequency vs caching behavior
- Validates cache hit (no additional findNode call), dispose reset, and cache miss pattern
- Cross-platform path handling for Windows vs Unix systems (L50)

## Key Behavioral Validations
- **Initialization**: Warning deduplication and proper event/state handling
- **Caching**: Per-instance cache lifecycle tied to dispose operations
- **State Management**: Transitions between UNINITIALIZED and READY states
- **Event Emission**: 'initialized' event fired exactly once per successful initialization

## Architecture Insights
- Uses event-driven architecture with state management
- Implements caching layer for executable resolution
- Clear separation between validation warnings and errors
- Mock-friendly design enabling precise behavioral testing
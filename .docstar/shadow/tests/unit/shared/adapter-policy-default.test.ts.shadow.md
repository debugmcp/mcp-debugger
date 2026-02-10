# tests/unit/shared/adapter-policy-default.test.ts
@source-hash: 9d0687523d58f921
@generated: 2026-02-10T00:41:34Z

## Test Suite: DefaultAdapterPolicy Unit Tests

**Purpose**: Validates the behavior of the `DefaultAdapterPolicy` class, ensuring it provides safe no-op implementations for all adapter policy interface methods.

### Test Structure

**Main Describe Block** (L4-34): `DefaultAdapterPolicy` test suite containing two behavioral test cases.

### Test Cases

**"exposes safe no-op behaviors"** (L5-19): Comprehensive verification of all `DefaultAdapterPolicy` static methods and properties:
- **Basic Properties** (L6-8): Validates `name`, `supportsReverseStartDebugging`, and `childSessionStrategy` 
- **Configuration Methods** (L9, 12, 14, 17-18): Tests `shouldDeferParentConfigDone`, `getDapAdapterConfiguration`, `getDebuggerConfiguration`, `getInitializationBehavior`, and `getDapClientBehavior`
- **Child Session Handling** (L10-11): Verifies `buildChildStartArgs` throws exception and `isChildReadyEvent` returns false
- **Utility Methods** (L13, 15-16): Tests `resolveExecutablePath`, `requiresCommandQueueing`, and `matchesAdapter`

**"tracks state transitions via createInitialState"** (L21-33): Tests state management functionality:
- **Initial State** (L22-26): Verifies `createInitialState` returns proper default state with `initialized` and `configurationDone` set to false
- **State Queries** (L25-26): Tests `isInitialized` and `isConnected` methods return false for initial state
- **State Updates** (L28-32): Validates that `updateStateOnCommand` and `updateStateOnEvent` are no-op implementations

### Dependencies
- **Testing Framework**: Vitest (`describe`, `it`, `expect`) (L1)
- **System Under Test**: `DefaultAdapterPolicy` from shared interfaces (L2)

### Key Patterns
- Uses static method testing pattern throughout
- Employs type assertion `as any` for mock event objects (L11)
- Tests both positive behaviors and expected failures (throwing exceptions)
- Validates that optional chaining operators work correctly for potentially undefined methods (L28, 31)
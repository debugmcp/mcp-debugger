# packages/shared/tests/unit/adapter-policy-js.spec.ts
@source-hash: 494eb56e2db92070
@generated: 2026-02-09T18:14:15Z

## Test Suite for JavaScript Debug Adapter Policy

This test file comprehensively validates the `JsDebugAdapterPolicy` class behavior for JavaScript/Node.js debugging session management.

### Key Test Structure
- **Helper Function**: `createStackFrame` (L5-13) - Utility to generate mock debug protocol stack frames with id, name, and file path
- **Main Test Suite**: `JsDebugAdapterPolicy` (L15-230) - Validates all static methods and behaviors

### Core Functionality Tests

**Child Session Management** (L16-26)
- Tests `buildChildStartArgs` method for creating attach commands with pending target IDs
- Validates command structure includes `request: 'attach'`, `__pendingTargetId`, and `continueOnAttach: true`

**Stack Frame Filtering** (L28-43)
- Tests `filterStackFrames` method behavior for removing Node.js internal frames
- Validates fallback behavior: keeps first frame when all frames would be filtered
- Uses `<node_internals>/` pattern recognition

**Variable Extraction** (L45-94)
- Tests `extractLocalVariables` method with comprehensive scope/variable mocking
- Validates filtering of special variables (`this`, `__proto__`) by default
- Tests optional inclusion of special variables when explicitly requested
- Uses structured test data with scope references (100, 200) and variable hierarchies

**Command Queueing Logic** (L96-135)
- Tests `shouldQueueCommand` and `processQueuedCommands` for proper DAP command sequencing
- Validates initialization flow: commands queue until initialize response received
- Tests deferred execution: launch waits for configurationDone
- Validates command ordering: configuration → configurationDone → launch → others

**State Management** (L137-150)
- Tests state update methods: `updateStateOnCommand` and `updateStateOnEvent`
- Validates state flags: `startSent`, `initialized`, `initializeResponded`
- Tests connection and initialization status helpers

**Adapter Identification** (L152-168)
- Tests `matchesAdapter` method for recognizing js-debug adapter instances
- Uses pattern matching against command paths containing 'js-debug' and 'vsDebugServer.cjs'

**Configuration Behaviors** (L170-176, L208-229)
- Tests `getInitializationBehavior` returning `deferConfigDone: true` and `addRuntimeExecutable: true`
- Tests `getAdapterSpawnConfig` for adapter process spawning with environment variables

**DAP Client Integration** (L178-206)
- Tests `getDapClientBehavior` including adapter ID normalization ('javascript' → 'pwa-node')
- Tests reverse debugging request handling with mock context and response capture
- Validates child session creation with pending target adoption

### Dependencies
- **Vitest**: Testing framework (L1)
- **VSCode Debug Protocol**: Type definitions for DAP structures (L2)
- **JsDebugAdapterPolicy**: Main class under test from adapter-policy-js.js (L3)

### Architecture Notes
- Extensive use of non-null assertion operator (!) indicating optional method testing
- Mock-heavy approach using structured test data for complex DAP scenarios
- State mutation testing with type assertions (`as any`) for internal state access
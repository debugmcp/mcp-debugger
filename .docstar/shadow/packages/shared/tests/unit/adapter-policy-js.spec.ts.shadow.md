# packages/shared/tests/unit/adapter-policy-js.spec.ts
@source-hash: 494eb56e2db92070
@generated: 2026-02-10T00:41:20Z

**Test Suite for JavaScript Debug Adapter Policy**

This file contains comprehensive unit tests for the `JsDebugAdapterPolicy` class, which manages JavaScript/Node.js debugging sessions through the Debug Adapter Protocol (DAP).

## Test Utilities
- `createStackFrame()` (L5-13): Helper function that generates mock DebugProtocol.StackFrame objects for testing

## Core Functionality Tests

### Child Process Management
- `buildChildStartArgs` tests (L16-26): Validates creation of attach commands for pending debug targets with proper configuration including `__pendingTargetId` and `continueOnAttach` flags

### Stack Frame Filtering  
- `filterStackFrames` tests (L28-43): Ensures internal Node.js frames (like `<node_internals>/lib.js`) are filtered out while preserving at least one frame as fallback when all frames are internal

### Variable Extraction
- `extractLocalVariables` tests (L45-94): Tests extraction of local variables from debug scopes, including:
  - Empty frame handling
  - Filtering out special variables (`this`, `__proto__`) by default (L53-73)
  - Optional inclusion of special variables when requested (L75-93)

### Command Queue Management
- Command queueing tests (L96-135): Critical DAP initialization flow management:
  - `initialize` commands bypass queueing (L97-101)
  - Commands queue until initialize response received (L103-108) 
  - `launch` commands defer until `configurationDone` sent (L110-118)
  - Command ordering: configuration → configDone → start → others (L120-134)

### State Management
- State helper tests (L137-150): Validates state transitions during debug session lifecycle including connection and initialization status tracking

### Adapter Detection
- `matchesAdapter` tests (L152-168): Identifies js-debug adapter processes by looking for specific tokens in command/args

### Initialization Behavior
- Configuration tests (L170-176): Verifies enablement of configuration deferral and runtime executable injection

### DAP Client Behavior  
- Client behavior tests (L178-206): Tests adapter ID normalization (`javascript` → `pwa-node`) and reverse start debugging request handling with child session creation

### Adapter Spawning
- Spawn configuration tests (L208-229): Validates adapter process spawn configuration including command, args, environment, and network settings

## Key Dependencies
- Uses vitest testing framework
- Imports `@vscode/debugprotocol` types for DAP compliance
- Tests the `JsDebugAdapterPolicy` from `adapter-policy-js.js`

## Testing Patterns
- Extensive use of mock objects and type assertions
- Tests both positive and edge cases (empty arrays, all-internal frames)
- Validates complex state transitions and command ordering logic
- Uses non-null assertion operator (`!`) extensively, indicating optional method testing
# packages/adapter-javascript/tests/unit/javascript-debug-adapter.more-branches.edge.test.ts
@source-hash: 70781ae99304dcf1
@generated: 2026-02-09T18:14:04Z

## Purpose and Responsibility

Edge case test suite for JavascriptDebugAdapter that covers additional branch paths and error conditions not tested in primary unit tests. Focuses on logging behavior, state transitions, configuration transformations, event handling, and dependency requirements.

## Key Test Structure

**Mock Dependencies (L8-19):**
- `depsWithLogger` (L8-15): Mock dependencies with vitest logger functions
- `depsNoLogger` (L17-19): Dependencies with undefined logger for fallback testing

**Test Setup (L21-29):**
- Standard vitest hooks with mock restoration and clearing

## Critical Test Cases

**Runtime Detection Edge Case (L31-41):**
- Tests `determineRuntimeExecutable()` fallback when no TypeScript runners detected
- Validates console.warn fallback when dependency logger unavailable
- Mocks `detectTypeScriptRunners` to return undefined runners

**Disposal Without Connection (L43-61):**
- Tests `dispose()` behavior when adapter never connected
- Validates event emission sequence (only 'disposed', not 'disconnected')
- Confirms state reset to UNINITIALIZED and connection status false

**Configuration Transformation (L63-73):**
- Tests `transformLaunchConfig()` environment variable handling
- Validates user-provided NODE_ENV preservation
- Confirms process.env merging with custom variables

**Event Handling Branches (L75-88, L90-106):**
- Tests 'continued' event handling (state unchanged)
- Tests unknown/custom event handling via default branch
- Validates event re-emission with body preservation

**Dependency Requirements (L108-115):**
- Tests `getRequiredDependencies()` return structure
- Validates Node.js dependency specification with version and install URL

## Dependencies and Imports

- **JavascriptDebugAdapter** (L3): Main class under test
- **AdapterState** (L4): Enum for adapter state validation
- **DebugProtocol** (L5): VSCode Debug Adapter Protocol types
- **Vitest testing framework** (L2): Test runner and mocking utilities

## Testing Patterns

- **Type casting with `as any`** for accessing private methods/properties
- **Event listener pattern** for testing event emissions
- **Mock spying** on console methods and internal functions
- **Async/await** for testing promise-based adapter methods
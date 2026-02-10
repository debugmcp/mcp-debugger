# packages/adapter-javascript/tests/unit/javascript-debug-adapter.more-branches.edge.test.ts
@source-hash: c9696b081a8778bd
@generated: 2026-02-10T21:25:33Z

## Purpose
Unit test file providing additional branch coverage for the `JavascriptDebugAdapter` class, focusing on edge cases and less common code paths to improve test coverage.

## Test Structure
- **Main Test Suite** (L21-104): "JavascriptDebugAdapter additional branch coverage"
- **Setup/Teardown** (L22-29): Mock restoration and cleanup using Vitest
- **Test Dependencies** (L8-19): Two mock AdapterDependencies variants - one with logger, one without

## Key Test Cases

### Disposal Without Connection Test (L31-49)
Tests adapter disposal behavior when no prior connection was established:
- Verifies only 'disposed' event is emitted (not 'disconnected')
- Confirms state resets to UNINITIALIZED
- Ensures connection status returns false

### Configuration Transformation Test (L51-61)
Tests `transformLaunchConfig` method:
- Verifies user-provided `NODE_ENV` is preserved
- Confirms custom environment variables are merged
- Tests environment variable handling in launch configuration

### DAP Event Handling Tests (L63-94)
Two tests covering Debug Adapter Protocol event handling:

#### Continued Event Test (L63-76)
- Tests 'continued' event handling leaves adapter state unchanged
- Uses mock DebugProtocol.Event structure

#### Unknown Event Test (L78-94)
- Tests default branch for unrecognized DAP events
- Verifies custom events are properly emitted with body data
- Uses event listener to capture emitted events

### Dependencies Query Test (L96-103)
Tests `getRequiredDependencies` method:
- Verifies returns array of dependency objects
- Confirms Node.js dependency is included with version and install URL
- Validates dependency metadata structure

## Dependencies
- **Vitest**: Testing framework (describe, it, expect, vi mocks)
- **JavascriptDebugAdapter**: Main class under test from `../../src/index.js`
- **@debugmcp/shared**: AdapterState enum and AdapterDependencies type
- **@vscode/debugprotocol**: DebugProtocol types for DAP events

## Testing Patterns
- Mock-based testing using Vitest spies and mocks
- Event-driven testing with custom event listeners
- State verification through adapter getState() calls
- Configuration transformation testing with type assertions
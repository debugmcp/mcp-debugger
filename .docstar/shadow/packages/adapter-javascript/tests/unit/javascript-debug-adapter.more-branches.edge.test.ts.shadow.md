# packages/adapter-javascript/tests/unit/javascript-debug-adapter.more-branches.edge.test.ts
@source-hash: 70781ae99304dcf1
@generated: 2026-02-10T00:41:07Z

**Purpose**: Edge case and branch coverage test suite for `JavascriptDebugAdapter`, targeting specific code paths and error conditions not covered by main unit tests.

**Test Structure**:
- Setup with mock dependencies (L8-19): `depsWithLogger` with mock logger, `depsNoLogger` without logger
- Standard vitest lifecycle hooks (L22-29) for mock management

**Key Test Cases**:

1. **Runtime Executable Fallback (L31-41)**: Tests `determineRuntimeExecutable` when no TypeScript runners are detected and no dependency logger exists. Verifies fallback to console.warn and returns 'node' executable.

2. **Disposal Without Connection (L43-61)**: Tests adapter disposal without prior connection, ensuring only 'disposed' event is emitted (not 'disconnected'), and state resets to `UNINITIALIZED`.

3. **Launch Config Environment Handling (L63-73)**: Tests `transformLaunchConfig` respects user-provided `NODE_ENV` and merges with `process.env`, ensuring environment variable precedence.

4. **DAP Event Handling - Continued (L75-88)**: Tests `handleDapEvent` with 'continued' event leaves adapter state unchanged.

5. **DAP Event Handling - Unknown Events (L90-106)**: Tests default branch in `handleDapEvent` for unknown events, verifying custom events are emitted with their body objects intact.

6. **Dependency Requirements (L108-115)**: Tests `getRequiredDependencies` returns Node.js dependency information with version and installation URL.

**Dependencies**:
- `JavascriptDebugAdapter` from main source
- `AdapterState` enum from `@debugmcp/shared`
- `DebugProtocol` types from `@vscode/debugprotocol`
- Vitest testing framework

**Testing Patterns**:
- Heavy use of method mocking with `vi.spyOn()` and `mockImplementation()`
- Event emission verification
- State transition validation
- Type casting with `as any` for accessing private methods
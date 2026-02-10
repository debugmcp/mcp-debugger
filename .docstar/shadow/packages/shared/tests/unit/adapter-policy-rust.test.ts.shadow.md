# packages/shared/tests/unit/adapter-policy-rust.test.ts
@source-hash: 7ff5621d5162ffba
@generated: 2026-02-09T18:14:20Z

## Purpose
Unit test suite for `RustAdapterPolicy` class, verifying Rust/CodeLLDB debug adapter integration functionality. Tests adapter lifecycle management, variable filtering, executable validation, and platform-specific behavior.

## Key Test Structures

### Test Setup (L1-42)
- **Mock Configuration (L7-21)**: Mocks `fs/promises.access` and `child_process.spawn` for isolation
- **Platform Helper (L23-32)**: `setPlatform()` utility for testing cross-platform behavior
- **Test Lifecycle (L35-42)**: Resets mocks between tests and cleans environment variables

### Core Test Suites

#### Variable Extraction (L44-80)
- **Default Filtering (L52-65)**: Tests removal of debugger internal variables (`$__internal`, `_lldb_internal`)
- **Special Variables (L67-79)**: Tests inclusion of internal variables when `includeSpecial=true`

#### Executable Management (L82-136)
- **Path Resolution (L82-90)**: Tests executable path resolution from input params and `CARGO_PATH` env
- **Validation Suite (L92-136)**: 
  - **Success Case (L103-118)**: Mock child process emitting version output
  - **Spawn Failure (L120-129)**: Tests error handling when process spawn fails
  - **Missing File (L131-135)**: Tests behavior when executable doesn't exist

#### Adapter Configuration (L168-196)
- **Custom Commands (L169-180)**: Tests override of default adapter command/args/env
- **Platform-Specific (L182-195)**: Tests vendored CodeLLDB path generation per platform (Windows example)

### Adapter Behavior Tests

#### State Management (L138-146)
- Tests `createInitialState`, `updateStateOnCommand`, `updateStateOnEvent`
- Verifies connection/initialization status tracking

#### Command Queuing (L148-152)
- Validates that commands are never queued (`shouldQueue=false`, `shouldDefer=false`)

#### Adapter Matching (L154-166)
- Tests detection of CodeLLDB adapter invocations vs other executables

#### DAP Client Behavior (L198-217)
- Tests reverse request handling (`runInTerminal`)
- Mocks response collection and validates handling result

#### Session State (L219-224)
- Tests session readiness determination (ready only when `PAUSED`)

#### Child Sessions (L226-228)
- Tests that child session argument building throws (unsupported)

## Dependencies
- **vitest**: Testing framework with mocking capabilities
- **@vscode/debugprotocol**: DAP type definitions
- **events**: EventEmitter for mock child processes
- **RustAdapterPolicy**: Main class under test from `adapter-policy-rust.js`
- **SessionState**: Enum from `@debugmcp/shared`

## Test Patterns
- Extensive mocking of file system and process spawning
- Platform simulation for cross-platform testing
- Mock EventEmitter children for process validation
- Environment variable manipulation with cleanup
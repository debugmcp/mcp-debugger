# tests/unit/shared/adapter-policy-python.test.ts
@source-hash: 36c00b4ddcc9b163
@generated: 2026-02-09T18:14:46Z

## Unit Test Suite for PythonAdapterPolicy

Comprehensive test suite for the Python debug adapter policy implementation, validating core functionality across child session handling, variable extraction, executable resolution, state management, and adapter matching.

### Test Setup & Environment Management (L8-23)
- **beforeEach**: Captures original `process.env.PYTHON_PATH` and `process.platform` descriptors for isolation
- **afterEach**: Restores original environment state, properly handling undefined values and platform properties
- Ensures tests don't affect global environment state

### Core Functionality Tests

**Child Session Rejection (L25-27)**
- Validates that `PythonAdapterPolicy.buildChildStartArgs()` throws exception with message "does not support child sessions"

**Local Variable Extraction (L29-55)**
- Tests `PythonAdapterPolicy.extractLocalVariables()` with mock debug frames, scopes, and variables
- Verifies filtering logic that excludes special variables (`special variables`, `_pydevd_bundle`) while preserving regular variables and Python built-ins (`__name__`)
- Input structure: frames array with IDs, scopes mapping frame IDs to scope arrays, variables mapping scope references to variable arrays

**Executable Path Resolution (L57-72)**
- Tests `PythonAdapterPolicy.resolveExecutablePath()` precedence rules:
  1. Explicit path parameter (highest priority)
  2. `PYTHON_PATH` environment variable
  3. Platform-specific defaults: 'python' on Windows, 'python3' on other platforms
- Manipulates `process.env.PYTHON_PATH` and `process.platform` to test different scenarios

**Command Queueing & State Management (L74-87)**
- Validates that Python adapter doesn't require command queueing (`requiresCommandQueueing()` returns false)
- Tests state lifecycle:
  - `createInitialState()`: Creates uninitialized state object
  - `updateStateOnEvent('initialized')`: Transitions to initialized and connected state
  - `updateStateOnCommand('configurationDone')`: Sets configuration completion flag
- Verifies `isInitialized()` and `isConnected()` state queries

**Adapter Matching (L89-96)**
- Tests `PythonAdapterPolicy.matchesAdapter()` recognition of debugpy commands
- Returns true for `python -m debugpy.adapter` pattern, false for other command structures

**Initialization Behavior (L98-100)**
- Confirms `PythonAdapterPolicy.getInitializationBehavior()` returns empty object (no special initialization requirements)

### Dependencies
- **vitest**: Testing framework providing describe/it/expect/beforeEach/afterEach
- **PythonAdapterPolicy**: Main class under test from `../../../packages/shared/src/interfaces/adapter-policy-python.js`

### Testing Patterns
- Environment isolation through setup/teardown
- Mock data structures for debug protocol objects
- Platform-specific behavior validation
- State transition verification
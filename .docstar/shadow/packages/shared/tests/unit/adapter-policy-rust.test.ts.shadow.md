# packages/shared/tests/unit/adapter-policy-rust.test.ts
@source-hash: 7ff5621d5162ffba
@generated: 2026-02-10T00:41:19Z

## Purpose
Test suite for RustAdapterPolicy class, validating Rust debugging adapter functionality including variable extraction, executable resolution/validation, state management, and DAP protocol handling.

## Test Structure
- **Main test suite**: `RustAdapterPolicy` (L34-229)
- **Setup/teardown**: Mock reset (L35-42) with `accessMock` and `spawnMock` cleanup
- **Platform utility**: `setPlatform()` (L23-32) for cross-platform testing

## Key Test Categories

### Variable Extraction (L44-80)
- **`extractLocalVariables`** tests filtering of debugger internals vs user variables
- Validates default filtering behavior (L52-65) and special variable inclusion (L67-79)
- Uses mock `DebugProtocol.StackFrame` and variable data structures

### Executable Management (L82-136)
- **`resolveExecutablePath`** (L82-90): Tests path resolution via inputs and `CARGO_PATH` env var
- **`validateExecutable`** (L92-136): Tests binary validation through version checking
  - Mock child process creation helper `createChild()` (L93-101)
  - Success case with version output (L103-118)
  - Failure cases for spawn errors (L120-129) and missing files (L131-135)

### State Management (L138-146)
- Tests state creation, command/event updates, and initialization tracking
- Validates `configurationDone` state and connection status

### Adapter Configuration (L154-196)
- **`matchesAdapter`** (L154-166): CodeLLDB command recognition
- **`getAdapterSpawnConfig`** (L168-196): 
  - Custom adapter command handling (L169-180)
  - Platform-specific vendored adapter paths (L182-195)

### Protocol Handling (L198-228)
- **DAP client behavior** (L198-217): Reverse request handling via mock context
- **Session readiness** (L219-224): State-based readiness determination
- **Child session args** (L226-228): Expected throw behavior

## Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **@vscode/debugprotocol**: DAP type definitions
- **EventEmitter**: Mock child process simulation
- **@debugmcp/shared**: SessionState enum

## Mock Strategy
- **fs/promises**: File access validation (L10-13)
- **child_process**: Spawn behavior with partial actual import (L15-21)
- Platform simulation via `process.platform`/`process.arch` manipulation

## Key Patterns
- Extensive use of mock functions with reset between tests
- Platform-agnostic testing with temporary platform overrides
- Event-driven testing for child process simulation
- Type-safe mock implementations maintaining original signatures
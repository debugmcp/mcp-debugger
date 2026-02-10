# packages/adapter-javascript/tests/unit/javascript-debug-adapter.lifecycle.test.ts
@source-hash: 3c1812ef94f04ab3
@generated: 2026-02-10T00:41:08Z

## Purpose
Unit test suite for JavascriptDebugAdapter lifecycle management, validating state transitions and event emissions during initialization, failure scenarios, and disposal.

## Test Structure
- **Test Suite** (L16): `JavascriptDebugAdapter.lifecycle` - covers adapter lifecycle operations
- **Setup** (L19-23): Creates fresh adapter instance with mocked dependencies before each test
- **Dependencies Mock** (L7-14): Minimal logger stub satisfying AdapterDependencies interface

## Key Test Cases

### Initialize Success (L25-45)
- **Purpose**: Validates successful initialization flow
- **Key Assertions**:
  - State transitions: UNINITIALIZED → INITIALIZING → READY (L41-43)
  - Single 'initialized' event emission (L44)
  - Mocks `validateEnvironment` to return valid state (L33-37)

### Initialize Failure (L47-65)
- **Purpose**: Tests initialization failure handling
- **Key Behavior**:
  - Mocks `validateEnvironment` to return invalid state with errors (L48-52)
  - Verifies AdapterError thrown with ENVIRONMENT_INVALID code (L61-63)
  - Confirms state transition to ERROR (L64)

### Dispose Lifecycle (L67-90)
- **Purpose**: Tests proper cleanup and event ordering
- **Setup**: Initializes and connects adapter first (L69-75)
- **Key Validations**:
  - Event emission order: 'disconnected' then 'disposed' (L84-85)
  - State reset to UNINITIALIZED (L87)
  - Connection and thread state cleared (L88-89)

## Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **@debugmcp/shared**: Core adapter types (AdapterState, AdapterError, AdapterErrorCode)
- **JavascriptDebugAdapter**: Main adapter class being tested

## Testing Patterns
- Event listener pattern for state change tracking (L27-28)
- Mock-based environment validation testing
- Lifecycle state verification through getters
# tests/unit/session-manager-operations-coverage.test.ts
@source-hash: b28c3e685d29da85
@generated: 2026-02-10T21:25:43Z

## Primary Purpose
Comprehensive test coverage for `SessionManagerOperations` error paths and edge cases, focusing on proxy failures, network errors, timeout scenarios, and MSVC toolchain detection for Rust debugging. Uses a concrete test subclass (L12-16) to test the abstract base class.

## Test Structure
- **TestableSessionManagerOperations** (L12-16): Concrete subclass with no-op `handleAutoContinue()` for testing
- **Mock Setup** (L35-133): Extensive mocks for all dependencies including SessionStore, ProxyManager, FileSystem, NetworkManager, AdapterRegistry
- **Test Organization**: 15 describe blocks covering specific error scenarios and edge cases

## Key Test Areas

### Proxy Manager Startup Errors (L135-288)
- Log directory creation failures (L136-142)
- Python interpreter resolution failures - throws `PythonNotFoundError` (L144-154)
- Non-Python executable resolution - throws `DebugSessionCreationError` (L164-175)
- MSVC toolchain validation for Rust (L254-287) - captures structured error with `MSVC_TOOLCHAIN_DETECTED` message

### Debug Session Operations Failures (L339-416)
- Continue operations without proxy or when proxy not running - throws `ProxyNotRunningError` (L340-352)
- Step operations (stepOver, stepInto, stepOut) with DAP protocol errors and timeouts (L362-415)
- Timeout handling using fake timers for 5-second step operation timeouts (L382-403)

### Breakpoint Operations (L418-470)
- Breakpoint setting without active proxy - queues unverified breakpoint (L419-428)
- DAP response failures and network errors - logs errors but creates unverified breakpoint (L430-469)

### Variable/Stack Inspection (L472-599)
- `getVariables`, `getStackTrace`, `getScopes` - return empty arrays on errors or missing proxy (L472-599)
- Malformed DAP responses handled gracefully

### Expression Evaluation (L601-739)
- Network failures and syntax error mapping (L649-663)
- Success path with stack trace resolution and frame ID usage (L695-739)
- Timeout scenarios with fake timers

### Debug Session Lifecycle (L741-1184)
- Dry run completion detection and timeout handling (L742-782, L1186-1256)
- Proxy startup failures with log tail capture (L885-924)
- Handshake failures and adapter readiness timeouts (L1103-1183)
- MSVC toolchain structured responses (L291-337)

## Test Utilities & Patterns
- **Fake Timers**: Extensive use of `vi.useFakeTimers()` for timeout testing
- **Environment Mocking**: CI/GitHub Actions environment variable manipulation
- **Mock Chaining**: Fluent interfaces on proxy manager mocks
- **Error Assertion Patterns**: Mix of `expect().rejects.toThrow()` and result object validation

## Key Dependencies
- **Vitest**: Primary testing framework with mocking capabilities
- **@debugmcp/shared**: Session state enums and types
- **@vscode/debugprotocol**: DAP protocol types
- **Custom Errors**: SessionNotFoundError, ProxyNotRunningError, PythonNotFoundError, DebugSessionCreationError

## Coverage Focus
Specifically targets error paths, timeout scenarios, and edge cases that are difficult to trigger in normal operation, ensuring robust error handling in the SessionManagerOperations implementation.
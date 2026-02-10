# tests/core/unit/session/session-manager-error-recovery.test.ts
@source-hash: fad556491fed2237
@generated: 2026-02-09T18:14:21Z

**Purpose**: Test suite for SessionManager error recovery and resilience scenarios using Vitest framework.

**Test Structure**:
- **Main test suite** (L9): "SessionManager - Error Recovery" validates how SessionManager handles various failure conditions
- **Setup/Teardown** (L14-32): Establishes fake timers, mock dependencies, and test configuration with cleanup
- **Two test categories**:
  - **Proxy Crash Recovery** (L34-93): Tests handling of unexpected proxy process termination
  - **Timeout Handling** (L95-156): Tests proxy initialization and DAP command timeout scenarios

**Key Dependencies**:
- `SessionManager` from `../../../../src/session/session-manager.js` - Main class under test
- `createMockDependencies` from `./session-manager-test-utils.js` - Mock factory for test isolation
- `@debugmcp/shared` types: `DebugLanguage`, `SessionState` - Shared type definitions
- Vitest testing utilities with fake timer support

**Critical Test Scenarios**:
1. **Proxy crash cleanup** (L35-53): Validates session transitions to ERROR state and proxy cleanup on SIGKILL
2. **Post-crash restart capability** (L55-76): Ensures sessions can restart after proxy failure
3. **Initialization failure handling** (L78-92): Tests early proxy exit scenarios before full initialization
4. **Timeout resilience** (L96-117): Validates proper handling of proxy initialization timeouts
5. **DAP command timeouts** (L119-139): Tests variable retrieval when session not in PAUSED state
6. **Cleanup after timeout** (L141-155): Ensures proper state management after initialization failures

**Test Configuration**:
- Uses fake timers for controlled async testing
- Mock proxy manager with configurable failure modes
- Standard test session config with `stopOnEntry: true`, `justMyCode: true`

**Architecture Patterns**:
- Comprehensive mock reset between tests via `dependencies.mockProxyManager.reset()`
- Timer advancement patterns for async operation testing
- State verification through direct session inspection
- Error simulation through mock configuration flags (`shouldFailStart`)
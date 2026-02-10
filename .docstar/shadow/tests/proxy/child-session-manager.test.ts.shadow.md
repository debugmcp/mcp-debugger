# tests/proxy/child-session-manager.test.ts
@source-hash: feee5f0a7c21fdf2
@generated: 2026-02-10T01:18:55Z

## Test Suite for ChildSessionManager

**Purpose:** Comprehensive test suite validating the ChildSessionManager class, which abstracts multi-session debugging scenarios and policy-driven child session management.

### Mock Infrastructure

**MockMinimalDapClient (L14-53):** Complete mock implementation extending EventEmitter that simulates DAP client behavior:
- Tracks connection state, requests, and provides policy support
- Simulates async `connect()`, `sendRequest()` with realistic responses for 'initialize' and 'threads' commands
- Includes shutdown/disconnect lifecycle methods

**Module Mocking (L56-58):** Uses Vitest to mock MinimalDapClient import to avoid circular dependencies.

### Test Structure

**JavaScript Policy Tests (L68-213):** Validates multi-session debugging behavior:
- Child session creation with event emission verification (L78-97)
- Command routing logic - routes execution commands to children but not initialization commands (L99-109) 
- Breakpoint mirroring functionality with storage validation (L111-140)
- Concurrent adoption handling and duplicate request protection (L143-190)
- Event forwarding from child to parent sessions (L193-211)

**Python Policy Tests (L215-241):** Validates single-session debugging behavior:
- Confirms commands are NOT routed to children (L225-229)
- Verifies breakpoints are NOT mirrored for Python sessions (L231-240)

**Default Policy Tests (L243-258):** Basic validation for fallback policy with no child session support.

**Shutdown Tests (L260-284):** Verifies proper cleanup of all child sessions during manager shutdown.

### Key Dependencies

- `@vscode/debugprotocol` - DAP protocol types
- `@debugmcp/shared` - AdapterPolicy implementations (JsDebugAdapterPolicy, PythonAdapterPolicy, DefaultAdapterPolicy)
- `ChildSessionManager` from proxy module
- `MinimalDapClient` interface type

### Testing Patterns

- Event-driven testing using spies and event listeners
- Async session creation with Promise handling
- Policy-specific behavior validation across different adapter types
- Mock request tracking for command verification
- State assertion patterns for session lifecycle management
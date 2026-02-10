# tests/proxy/dap-client-behavior.test.ts
@source-hash: a0e5af43495c6591
@generated: 2026-02-10T00:42:01Z

## Test Suite: DapClientBehavior Implementations

**Purpose**: Comprehensive test coverage for DAP (Debug Adapter Protocol) client behavior implementations across different adapter policies in the debugmcp proxy system.

### Test Structure
- **Main Suite**: `DapClientBehavior` (L15-242)
- **Mock Context Setup**: `mockContext` with vitest mocks for DAP operations (L18-25)

### Core Policy Test Coverage

#### JsDebugAdapterPolicy Tests (L27-139)
- **Reverse Request Handling** (L30-103):
  - `startDebugging` with `__pendingTargetId` - creates child sessions for new targets (L31-53)
  - Duplicate target adoption prevention (L55-75)
  - `runInTerminal` request handling (L77-89)
  - Unknown command rejection (L91-102)

- **Command Routing Configuration** (L105-121):
  - Child-routed commands: threads, pause, continue, stackTrace, scopes, variables, evaluate (L106-114)
  - Parent-only commands: initialize, launch, attach (L116-120)

- **JavaScript-Specific Settings** (L123-138):
  - Child session management flags: `mirrorBreakpointsToChild=true`, `deferParentConfigDone=true`, `pauseAfterChildAttach=true`
  - Extended timeout: `childInitTimeout=12000ms`
  - Adapter ID normalization: `javascript` → `pwa-node` (L132-137)

#### PythonAdapterPolicy Tests (L141-183)
- **Limited Reverse Request Support**: Only handles `runInTerminal`, rejects `startDebugging` (L144-171)
- **Python-Specific Configuration**: No child routing, minimal session management, `childInitTimeout=5000ms` (L173-182)

#### MockAdapterPolicy Tests (L185-197)
- **Minimal Implementation**: No reverse request handling, basic configuration with `childInitTimeout=1000ms`

#### DefaultAdapterPolicy Tests (L199-207)
- **Empty Behavior**: Returns empty object `{}` with no specialized functionality

### Cross-Policy Comparison Tests (L209-241)
- **JavaScript Uniqueness**: Only policy with child session support and breakpoint mirroring (L210-226)
- **Policy Distinctness**: Validates all policies have unique names (L228-240)

### Key Dependencies
- **Testing Framework**: vitest with mocking capabilities
- **Protocol Types**: `@vscode/debugprotocol` for DAP request/response structures
- **Shared Types**: `@debugmcp/shared` for context interfaces and policy implementations

### Testing Patterns
- Mock-based isolation using vitest `vi.fn()`
- Async request/response testing with `ReverseRequestResult`
- Configuration validation through property assertions
- Cross-policy behavioral comparison testing

### Critical Behaviors Tested
- Child session creation logic with pending target tracking
- Command routing to appropriate session contexts
- Adapter-specific timeout and behavioral configurations
- Request handling for terminal operations and debugging sessions
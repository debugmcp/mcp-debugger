# tests/unit/proxy/dap-proxy-connection-manager.test.ts
@source-hash: 193b74ad00533e27
@generated: 2026-02-09T18:14:54Z

## Test Suite for DapConnectionManager

This comprehensive test file validates the `DapConnectionManager` class from the DAP (Debug Adapter Protocol) proxy module. The test suite covers connection management, session initialization, event handling, and graceful disconnection scenarios.

### Test Structure & Setup (L47-84)

- **Mock Setup**: Creates comprehensive mocks for `IDapClient`, `IDapClientFactory`, and `ILogger` interfaces
- **Timer Management**: Uses `vi.useFakeTimers()` to control async retry logic and timeouts
- **Test Helpers**: 
  - `waitForRetries()` (L27-32): Advances timers to simulate retry intervals (200ms each)
  - `expectDisconnectCleanup()` (L34-38): Validates proper disconnect logging
  - `errorScenarios` (L40-45): Test data for various connection error types

### Connection Management Tests (L86-240)

**connectWithRetry Method Testing:**
- **Success Path** (L87-102): Validates successful first-attempt connection with proper event handler setup
- **Retry Logic** (L104-123): Tests exponential backoff with 200ms intervals, up to 60 attempts
- **Failure Scenarios** (L125-147): Verifies proper error handling after maximum retry attempts
- **Error Event Handling** (L149-175): Tests temporary error handler during connection phase
- **Edge Cases**: Intermediate retry counts (L195-218), exception cleanup (L220-239)

### Session Management Tests (L242-317)

**initializeSession Method** (L242-269):
- Sends DAP initialize request with standardized client configuration
- Client ID format: `mcp-proxy-{sessionId}`
- Fixed adapter configuration for Python debugging

**setupEventHandlers Method** (L271-317):
- Configures optional event handlers for DAP protocol events
- Supports: initialized, output, stopped, continued, thread, exited, terminated, error, close
- Handles partial handler objects gracefully

### Disconnection Management Tests (L319-429)

**disconnect Method Features:**
- **Graceful Shutdown**: Sends DAP disconnect request with configurable `terminateDebuggee` flag
- **Timeout Handling**: 1000ms timeout for disconnect requests with fallback cleanup
- **Error Recovery**: Continues cleanup even if disconnect request fails
- **Null Safety**: Handles null client references without errors

### DAP Protocol Operations (L431-731)

**sendLaunchRequest Method** (L431-478):
- Configures Python program launch with customizable parameters
- Default settings: `stopOnEntry: true`, `justMyCode: true`, `console: 'internalConsole'`

**setBreakpoints Method** (L480-709):
- Supports single/multiple breakpoints with optional conditions
- Handles edge cases: empty arrays, duplicates, large datasets (100+ breakpoints)
- Validates both successful and failed breakpoint setting

**sendConfigurationDone Method** (L711-731):
- Sends final configuration completion signal to debugger

### Concurrency & State Management (L733-771)

Tests for:
- **Concurrent Connections**: Multiple simultaneous connection attempts to different ports
- **Rapid Cycles**: Quick disconnect/reconnect sequences without state corruption

### Key Dependencies

- **Vitest**: Testing framework with mock capabilities
- **@vscode/debugprotocol**: DAP protocol type definitions
- **DapConnectionManager**: Main class under test from `../../../src/proxy/dap-proxy-connection-manager.js`
- **Interfaces**: `IDapClient`, `IDapClientFactory`, `ILogger` from proxy interfaces

### Test Constants

- `CONNECT_RETRY_INTERVAL`: 200ms between connection attempts
- `INITIAL_CONNECT_DELAY`: 500ms before first connection attempt  
- `MAX_RETRIES`: 60 connection attempts
- `DISCONNECT_TIMEOUT`: 1000ms for graceful disconnect
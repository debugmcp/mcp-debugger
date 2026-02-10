# tests/unit/proxy/dap-proxy-connection-manager.test.ts
@source-hash: 193b74ad00533e27
@generated: 2026-02-10T00:41:45Z

**Test file for DapConnectionManager** - Comprehensive unit tests for Debug Adapter Protocol (DAP) connection management functionality.

## Test Structure
- **Main test suite**: `DapConnectionManager` (L10-772) - Tests core DAP client connection orchestration
- **Test setup/teardown**: Mock infrastructure with fake timers for retry logic testing (L47-84)

## Key Test Helper Functions
- `waitForRetries(count)` (L27-32) - Simulates retry timing by advancing fake timers by 200ms intervals
- `expectDisconnectCleanup()` (L34-38) - Validates proper logging during client disconnection
- `errorScenarios` (L40-45) - Predefined connection error scenarios for parameterized testing

## Test Categories

### Connection Management (`connectWithRetry`, L86-240)
- **Successful connection** (L87-102) - Tests first-attempt success with proper event handler setup
- **Retry logic** (L104-123) - Validates exponential backoff with 200ms intervals
- **Max retry failure** (L125-147) - Tests failure after 60 attempts with proper cleanup
- **Error handling during connection** (L149-175) - Tests temporary error events during connection phase
- **Retry count validation** (L195-218) - Tests intermediate retry states and progress tracking
- **Exception cleanup** (L220-239) - Ensures error handlers are removed on unexpected exceptions

### Session Initialization (`initializeSession`, L242-269)
- Tests DAP initialize request with Python adapter configuration
- Validates proper client ID formatting: `mcp-proxy-{sessionId}`

### Event Handler Setup (`setupEventHandlers`, L271-317)
- Tests conditional registration of DAP event handlers (initialized, output, stopped, etc.)
- Validates partial handler registration and empty handler object handling

### Disconnection Logic (`disconnect`, L319-429)
- **Graceful disconnection** (L329-339) - Default `terminateDebuggee: true` behavior
- **Custom termination control** (L341-349) - Tests `terminateDebuggee: false` option
- **Timeout handling** (L351-366) - 1000ms timeout for disconnect requests
- **Error recovery** (L368-409) - Tests both disconnect request and client.disconnect() failures
- **Race condition testing** (L411-428) - Validates timing between disconnect completion and timeout

### Launch Configuration (`sendLaunchRequest`, L431-478)
- Tests Python debugger launch with configurable parameters:
  - `stopOnEntry`, `noDebug`, `args`, `console`, `justMyCode`

### Breakpoint Management (`setBreakpoints`, L480-709)
- **Single/multiple breakpoints** (L483-547) - Basic breakpoint setting functionality
- **Conditional breakpoints** (L549-583) - Tests condition expressions
- **Edge cases** (L585-664) - Empty arrays, invalid data, large arrays (100+ breakpoints)
- **Duplicate handling** (L666-695) - Validates all breakpoints sent including duplicates

### Configuration Completion (`sendConfigurationDone`, L711-731)
- Tests final DAP setup step with proper logging

### Concurrency Testing (L733-771)
- **Concurrent connections** (L734-749) - Multiple simultaneous connection attempts
- **Rapid disconnect/reconnect** (L751-770) - Tests state management during rapid cycles

## Dependencies
- **Core class**: `DapConnectionManager` from `../../../src/proxy/dap-proxy-connection-manager.js` (L2)
- **Interfaces**: `IDapClient`, `IDapClientFactory`, `ILogger` (L3-7)
- **Protocol**: `@vscode/debugprotocol` for DAP message types (L8)
- **Test framework**: Vitest with comprehensive mocking capabilities (L1)

## Key Constants Referenced
- `CONNECT_RETRY_INTERVAL`: 200ms (L29)
- `INITIAL_CONNECT_DELAY`: 500ms (L93)
- Disconnect timeout: 1000ms (L363)
- Max retry attempts: 60 (L137, L142)

## Mock Architecture
- Comprehensive `mockDapClient` with all DAP methods (L11-20, L51-63)
- Factory and logger mocks for dependency injection testing (L22-24, L65-74)
- Fake timers for deterministic async behavior testing (L49, L82)
# tests/unit/proxy/proxy-manager.branch-coverage.test.ts
@source-hash: 832af11d970ac1fc
@generated: 2026-02-09T18:14:52Z

## Test Suite Purpose
Unit tests targeting branch coverage scenarios for ProxyManager class, focusing on edge cases and specific code paths through extensive mocking and state manipulation.

## Test Structure

### StubProxyProcess (L16-30)
Test double implementing IProxyProcess interface with mocked methods (send, sendCommand, kill, waitForInitialization). Provides controllable proxy process behavior with fixed sessionId 'session-1' and pid 9999.

### Test Setup (L39-61)
Each test initializes mocked dependencies:
- Logger with stubbed methods (info, warn, error, debug)
- FileSystem with pathExists returning true
- ProxyProcessLauncher with mocked launchProxy
- ProxyManager instance with forced internal state manipulation via type assertions

## Key Test Scenarios

### Command Processing Tests (L67-96)
- **killProcess command execution (L67-80)**: Verifies ProxyManager executes kill commands emitted by functional core
- **sendToProxy command routing (L82-96)**: Tests command forwarding through sendCommand method

### Error Handling Tests (L98-108)
Tests DAP state validation during message processing, ensuring proper error logging when state is missing.

### Status Message Handling (L110-149)
- **proxy_minimal_ran_ipc_test status (L110-118)**: Tests process termination trigger
- **adapter_connected status (L120-133)**: Verifies initialization marking and event emission
- **dry_run_complete status (L135-149)**: Tests snapshot preservation when status data is empty/whitespace

### DAP Event Processing (L151-224)
- **Stopped events (L151-201)**: Tests thread capture, reason forwarding, and barrier notifications
- **General event emission (L203-224)**: Tests continued events and default dap-event forwarding

### Launch Barrier Management (L226-366)
- **Response barrier resolution (L226-279)**: Tests barrier lifecycle during successful DAP request/response cycles
- **Error handling during sendCommand (L281-313)**: Ensures barrier cleanup on transport failures
- **Barrier reference validation (L315-345)**: Tests early exit for mismatched barrier references
- **Disposal error handling (L347-366)**: Tests graceful error handling during barrier disposal

## Testing Patterns

### State Manipulation
Extensive use of type assertions to access private ProxyManager properties (sessionId, proxyProcess, isInitialized, dapState) for test setup and verification.

### Mock Integration
Heavy reliance on vi.spyOn and mock functions to intercept method calls and control return values, particularly for dapCore.handleProxyMessage integration.

### Barrier Testing
Comprehensive coverage of AdapterLaunchBarrier lifecycle including creation, request tracking, event forwarding, and cleanup scenarios.

## Dependencies
- Vitest testing framework with mocking capabilities
- EventEmitter for test doubles
- ProxyManager from proxy module
- DAP core functionality and state management
- @debugmcp/shared interfaces and types
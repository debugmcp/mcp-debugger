# tests/unit/proxy/proxy-manager-message-handling.test.ts
@source-hash: d6e936a3823dbbf7
@generated: 2026-02-09T18:15:03Z

## Unit Test Suite for ProxyManager Message Handling and Cleanup

Comprehensive test suite for `ProxyManager` message handling capabilities, event propagation, cleanup scenarios, and edge case resilience. Uses `TestProxyManager` for simplified async initialization testing.

### Test Structure (L20-56)
- **Setup**: Creates mock logger, proxy config, and TestProxyManager instance
- **Teardown**: Ensures clean proxy shutdown and mock cleanup
- **Config**: Standard Python debug session configuration with breakpoints and dry-run options

### Core Message Handling Tests (L58-267)
Tests various message types and their event propagation:

- **Status Messages (L59-75)**: Validates `adapter_configured_and_launched` status triggers `adapter-configured` event
- **Dry-Run Messages (L77-101)**: Tests `dry_run_complete` status with command and script extraction
- **DAP Events (L103-170)**: 
  - Stopped events with thread ID capture (L103-116)
  - Continued events (L118-128) 
  - Terminated events (L130-145)
  - Exited events with exit code handling (L147-170)
- **DAP Responses (L172-197)**: Mock response handling for requests like `setBreakpoints`
- **Error Handling (L199-218)**: Error message propagation to error events
- **Malformed Messages (L220-266)**: Graceful handling of invalid JSON, empty messages, wrong session IDs

### Process Exit Handling (L269-328)
Tests proxy process lifecycle management:
- Clean exit scenarios with event emission
- Exit codes and signal handling 
- Error event propagation during proxy failures

### Cleanup Scenarios (L330-381)
Validates resource cleanup and concurrent request handling:
- Pending request cleanup on proxy exit
- Multiple concurrent DAP requests
- Timeout handling during cleanup
- Double-stop protection

### DAP Request Edge Cases (L383-436)
Tests request handling in failure scenarios:
- Requests when proxy not running
- Concurrent identical requests
- Failed DAP responses with error messages
- Request timeout behavior

### State Management (L438-466)
Tests internal state tracking:
- Current thread ID updates from stopped/continued events
- Dry-run mode state transitions

### Resilience and Error Recovery (L468-828)
Extensive testing of failure scenarios using real `ProxyManager`:

- **Invalid Message Handling (L473-484)**: Logs and ignores unknown message types
- **Request Timeouts (L486-513)**: 30s timeout with pending request cleanup
- **Bootstrap Validation (L515-546)**: Missing bootstrap script error handling
- **Transport Errors (L548-577)**: Command send failures with proper cleanup
- **Adapter Validation (L579-612)**: Environment validation failures
- **Launch Barriers (L614-827)**: 
  - Fire-and-forget launch for js-debug adapters
  - Barrier cleanup on proxy exit
  - Response handling with barrier disposal
  - Timeout scenarios with barrier cleanup

### Status and Lifecycle Management (L830-989)
Tests status transitions and event emission:
- `adapter_connected` → `initialized` event
- `adapter_exited` → `exit` event with code/signal
- Pending request rejection on proxy exit
- Duplicate test coverage for status transitions (L912-989)

### IPC Smoke Test (L991-1014)
Tests minimal proxy IPC validation with process termination on `proxy_minimal_ran_ipc_test` status.

### Key Dependencies
- `TestProxyManager`: Simplified proxy manager for testing
- `ProxyConfig`: Debug session configuration
- `DebugLanguage`: Language-specific debug adapter selection
- Mock factories for logger and filesystem operations
- Vitest framework with fake timers for timeout testing

### Test Patterns
- Event-driven testing with listener setup/verification
- Mock response injection for DAP request testing  
- Process lifecycle simulation
- Concurrent request validation
- Error boundary testing with type assertions
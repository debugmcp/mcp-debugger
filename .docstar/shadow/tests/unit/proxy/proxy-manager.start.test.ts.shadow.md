# tests/unit/proxy/proxy-manager.start.test.ts
@source-hash: a62c52f899e8a6f2
@generated: 2026-02-09T18:14:55Z

## Purpose

Unit test suite for the `ProxyManager.start()` method and related functionality, providing comprehensive coverage of proxy process initialization, lifecycle management, and error handling scenarios.

## Core Test Structure

- **FakeProxyProcess** (L10-23): Mock implementation of `IProxyProcess` extending EventEmitter with stubbed methods for `send`, `sendCommand`, `kill`, and `waitForInitialization`
- **Main test suite** (L25-1062): Tests `ProxyManager.start()` method with various configurations and failure modes
- **Helper test suite** (L1064-1210): Tests internal helper methods for script resolution and spawn context preparation

## Key Test Categories

### Initialization Flow (L108-196)
- Basic proxy launch and init command sending (L108-120)
- Prevention of multiple concurrent starts (L122-126)
- Dry-run command snapshot recording (L128-162, L164-195, L197-229)

### Environment Validation (L231-287)
- Adapter environment validation failures (L231-258)
- Executable path resolution errors (L260-287)

### Retry Handling (L289-361)
- Init command retry logic with fake timers (L298-332)
- Exhaustive retry failure with detailed error reporting (L334-360)

### Timeout and Exit Scenarios (L363-433)
- Proxy initialization timeout (L363-390)
- Clean dry-run exit handling (L392-409)
- Proxy exit with stderr capture (L411-425)
- Missing bootstrap script validation (L427-433)

### Process Management (L435-506)
- Invalid PID handling (L435-442)
- Proxy script resolution for different module layouts (L444-506)

### Stop and Cleanup (L508-568)
- Graceful termination with force kill fallback (L509-531)
- Already-exited process handling (L533-543)
- Cleanup of pending requests and launch barriers (L545-567)

### Command Diagnostics (L570-636)
- Send command validation and error handling (L571-599)
- Exit details logging for post-mortem debugging (L601-635)

### Event Handling (L638-851)
- IPC telemetry and heartbeat logging (L638-673)
- Proxy exit event processing (L675-720)
- Launch barrier integration for fire-and-forget operations (L722-754)
- Status message forwarding and lifecycle events (L756-850)

### DAP Request Management (L852-1061)
- Response resolution and thread ID capture (L852-889)
- Error propagation and timeout handling (L891-938)
- Transport failure recovery (L940-950)
- Concurrent stop/start interaction (L1010-1061)

## Key Dependencies

- **Vitest**: Test framework with mocking capabilities
- **EventEmitter**: For mock process communication
- **Path utilities**: File system path resolution
- **@debugmcp/shared**: Core interfaces (`IProxyProcess`, `IDebugAdapter`, etc.)
- **DAP state management**: From `../../../src/dap-core/index.js`

## Test Configuration

- **Base config** (L91-100): Standard proxy configuration for JavaScript debugging
- **Fake timers**: Used extensively for timeout and retry testing
- **Mock implementations**: Comprehensive mocking of file system, logger, and process launcher

## Notable Patterns

- Extensive use of type assertions to access private ProxyManager internals
- Async/await with fake timer advancement for timeout scenarios
- Event-driven test patterns matching the EventEmitter-based architecture
- Comprehensive error message validation for different failure modes
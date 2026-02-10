# tests/unit/proxy/proxy-manager.start.test.ts
@source-hash: a62c52f899e8a6f2
@generated: 2026-02-10T00:41:44Z

## ProxyManager.start() Unit Test Suite

This file provides comprehensive test coverage for the `ProxyManager` class's start functionality and related lifecycle operations. It's a critical test suite validating the initialization, communication, and error handling patterns of the proxy debugging system.

### Test Infrastructure & Mocks

**FakeProxyProcess (L10-23)**: Mock implementation of `IProxyProcess` extending EventEmitter. Provides stubbed methods for IPC communication (`send`, `sendCommand`, `kill`) and process lifecycle simulation. Key for isolating proxy behavior in tests.

**Test Setup (L25-89)**: Configures comprehensive mock ecosystem including:
- `proxyProcessLauncher` with `launchProxy` spy
- `fileSystem` with `pathExists` stub  
- `logger` with all log level methods
- Default `sendCommand` mock handling init handshake protocol

### Core Test Scenarios

**Basic Startup Flow (L108-120)**: Validates standard proxy initialization - process launch, init command dispatch, and session ID propagation.

**Concurrent Start Protection (L122-126)**: Ensures `start()` throws when proxy already running, preventing resource conflicts.

**Dry-Run Command Capture (L128-162, L164-195)**: Tests adapter command snapshot functionality for dry-run executions. Validates command reconstruction from adapter config vs fallback to executable path.

**Environment Validation (L231-287)**: Tests adapter environment validation integration - validates failure paths when environment invalid or executable resolution fails.

### Retry & Error Handling

**Init Retry Logic (L289-361)**: Complex test suite using fake timers to validate retry behavior on transient IPC failures. Tests exponential backoff and ultimate failure after retry exhaustion.

**Timeout Handling (L363-390)**: Validates 30-second initialization timeout when proxy never signals readiness.

**Exit During Initialization (L411-425, L972-1008)**: Tests failure scenarios where proxy exits before completing initialization, with stderr capture.

### Process Lifecycle Management  

**Stop Behavior (L508-568)**: Tests graceful shutdown with terminate command, force kill timeout, concurrent stop calls, and cleanup of pending requests/launch barriers.

**Event Forwarding (L756-850)**: Validates proxy message handling and event emission for status updates (dry-run-complete, initialized, adapter-configured, exit).

### DAP Request Handling

**Request/Response Flow (L852-889)**: Tests DAP command dispatch through proxy with response correlation and thread ID extraction.

**Error Scenarios (L891-970)**: Validates DAP request failures on proxy errors, timeouts, transport failures, and proxy exit during pending requests.

### Script Resolution

**findProxyScript Logic (L444-506)**: Tests bootstrap script path resolution across different deployment patterns (dist/, development layout, bundled).

**Runtime Environment Integration (L1086-1209)**: Tests spawn context preparation with adapter integration, environment cloning, and validation failure handling.

### Key Dependencies

- `@debugmcp/shared` types for proxy interfaces
- `../../../src/proxy/proxy-manager.js` - main class under test
- `../../../src/dap-core/index.js` for DAP state management
- Vitest testing framework with extensive timer mocking

### Test Patterns

The suite uses sophisticated async testing patterns with `vi.useFakeTimers()`, event emission simulation, and promise coordination. Heavy use of type casting to access private members for state verification and test orchestration.
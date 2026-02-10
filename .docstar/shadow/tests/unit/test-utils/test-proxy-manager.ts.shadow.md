# tests/unit/test-utils/test-proxy-manager.ts
@source-hash: 151df79c0f71525c
@generated: 2026-02-10T00:41:36Z

## Test Utility for ProxyManager Testing

This file provides a simplified test implementation of ProxyManager that overrides complex initialization and runtime behavior to enable synchronous, deterministic testing.

### Core Components

**TestProxyManager (L14-163)**: Extends the real ProxyManager with test-friendly overrides:
- **Constructor (L19-28)**: Accepts optional mock logger and filesystem, initializes pendingRequests map
- **start() (L33-45)**: Simplified startup that skips complex initialization, sets up DAP state synchronously, emits 'initialized' immediately
- **stop() (L50-64)**: Synchronous cleanup that clears state and emits 'exit'
- **sendDapRequest() (L69-106)**: Returns mock responses instead of real DAP communication, simulates pending request lifecycle
- **setMockResponse() (L111-113)**: Configures mock responses for specific DAP commands
- **simulateMessage() (L118-132)**: Allows injection of proxy messages for testing message handling
- **simulateStoppedEvent() (L137-140)**: Emits stopped events with configurable thread ID and reason
- **simulateContinuedEvent() (L145-148)**: Emits continued events and resets simulated thread
- **getCurrentThreadId() (L153-155)**: Returns simulated thread ID for testing thread state
- **isRunning() (L160-162)**: Simplified running state check based on mock proxyProcess

### State Management
- **mockResponses**: Map storing command-to-response mappings for DAP request simulation
- **simulatedThreadId**: Tracks current simulated thread for debugging state
- **lastSentCommand**: Records the most recent DAP command for test assertions

### Mock Factories
- **createMockLogger() (L168-175)**: Creates no-op logger implementation
- **createMockFileSystem() (L180-189)**: Creates mock filesystem with success-returning methods

### Key Dependencies
- Extends real ProxyManager from `../../../src/proxy/proxy-manager.js`
- Uses DAP state initialization from `../../../src/dap-core/index.js`
- Implements DebugProtocol types from @vscode/debugprotocol
- Relies on shared interfaces (IFileSystem, ILogger, IProxyProcessLauncher)

### Architecture Notes
- Uses type casting `(this as any)` to access private members of parent class
- Maintains compatibility with parent class event emitter interface
- Designed for synchronous testing patterns while preserving async method signatures
- Simulates pending request lifecycle for cleanup testing scenarios
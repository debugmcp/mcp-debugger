# tests/unit/test-utils/test-proxy-manager.ts
@source-hash: 151df79c0f71525c
@generated: 2026-02-09T18:14:46Z

## Purpose
Test utility that extends ProxyManager for deterministic, synchronous testing by overriding complex initialization and message handling with mock implementations.

## Core Classes

### TestProxyManager (L14-163)
Extends the production ProxyManager class to enable simplified testing scenarios.

**Key Properties:**
- `mockResponses` (L15): Map storing pre-configured responses for DAP commands
- `simulatedThreadId` (L16): Tracks current simulated thread state for testing
- `lastSentCommand` (L17): Captures the most recent command sent for verification

**Core Methods:**
- `constructor()` (L19-28): Initializes with mock dependencies, bypasses launcher requirement
- `start()` (L33-45): Overrides complex initialization, immediately emits 'initialized' event, sets up DAP state
- `stop()` (L50-64): Synchronous cleanup, clears internal state, emits 'exit' event
- `sendDapRequest()` (L69-106): Returns mock responses instead of actual DAP communication, simulates pending request lifecycle
- `setMockResponse()` (L111-113): Configures mock responses for specific DAP commands
- `simulateMessage()` (L118-132): Injects messages into the proxy message handler for testing
- `simulateStoppedEvent()` (L137-140): Triggers stopped event with thread ID and reason
- `simulateContinuedEvent()` (L145-148): Triggers continued event and clears thread state
- `getCurrentThreadId()` (L153-155): Returns simulated thread ID for testing
- `isRunning()` (L160-162): Simplified running state check

## Helper Functions

### createMockLogger() (L168-175)
Returns ILogger implementation with no-op methods for all log levels.

### createMockFileSystem() (L180-189)
Returns IFileSystem implementation with mock methods that simulate successful operations.

## Dependencies
- ProxyManager from proxy-manager.js (production class being tested)
- ProxyConfig from proxy-config.js (configuration interface)
- DebugProtocol types from @vscode/debugprotocol
- Shared interfaces (IFileSystem, ILogger, IProxyProcessLauncher) from @debugmcp/shared
- DAP core functionality dynamically imported for state initialization

## Testing Patterns
- Uses type casting `(this as any)` to access private members for testing
- Implements immediate resolution of promises to avoid async complexity in tests
- Simulates pending request lifecycle with immediate cleanup via `process.nextTick()`
- Provides event simulation methods for testing event-driven behavior
- Bypasses actual process launching and communication layers
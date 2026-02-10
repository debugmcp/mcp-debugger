# tests/test-utils/mocks/mock-proxy-manager.ts
@source-hash: 791970fddf17cc15
@generated: 2026-02-09T18:14:41Z

**Purpose**: Mock implementation of ProxyManager for testing VSCode debug adapter functionality. Provides a fully controllable proxy that simulates real ProxyManager behavior without external dependencies.

**Architecture**: Extends EventEmitter and implements IProxyManager interface. Maintains internal state to track running status, thread IDs, configuration, and dry-run status while providing extensive testing controls.

## Core Components

**MockProxyManager (L11-252)**: Main mock class with complete ProxyManager interface implementation
- Private state tracking: `_isRunning`, `_currentThreadId`, `_config`, `_dapRequestHandler` (L12-18)
- Public call tracking arrays for verification: `startCalls`, `stopCalls`, `dapRequestCalls` (L21-23)
- Behavioral control flags: `shouldFailStart`, `startDelay`, `shouldFailDapRequests`, `dapRequestDelay` (L26-29)

## Key Methods

**start(config) (L35-70)**: Simulates proxy startup with configurable delays and failures
- Records all start calls for test verification
- Emits appropriate initialization events based on config (dry-run vs normal mode)
- Handles `stopOnEntry` configuration with thread simulation

**stop() (L72-84)**: Cleanly shuts down proxy, resets state, emits exit event

**sendDapRequest<T>(command, args) (L86-180)**: Core DAP protocol handler with extensive mock responses
- Built-in responses for common commands: `setBreakpoints`, `stackTrace`, `scopes`, `variables`, `next`, `stepIn`, `stepOut`, `continue`
- Custom handler support via `_dapRequestHandler`
- Simulates stepping events and continuation behavior

## Test Utilities

**Event Simulation (L195-220)**:
- `simulateEvent()`: Generic event emission with state updates
- `simulateStopped()`, `simulateError()`, `simulateExit()`: Specific scenario helpers

**Dry-Run Support (L222-234)**:
- `hasDryRunCompleted()`: Status check
- `getDryRunSnapshot()`: Retrieve dry-run execution details

**State Management**:
- `reset() (L236-252)`: Complete state reset for test isolation
- `setDapRequestHandler() (L191-193)`: Custom DAP response injection

## Dependencies
- `EventEmitter` from Node.js events
- `DebugProtocol` from @vscode/debugprotocol for type safety
- Interface imports from `../../src/proxy/proxy-manager.js`

**Usage Pattern**: Instantiate mock, configure behavioral flags, call methods, verify tracked calls and emitted events. Supports both synchronous verification and asynchronous event-driven testing scenarios.
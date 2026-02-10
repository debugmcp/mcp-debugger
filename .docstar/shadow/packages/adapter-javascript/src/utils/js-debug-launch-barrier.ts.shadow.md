# packages/adapter-javascript/src/utils/js-debug-launch-barrier.ts
@source-hash: 247e3d83da1114ee
@generated: 2026-02-10T01:18:55Z

## Primary Purpose
Coordinates JavaScript debugger launch readiness by implementing a barrier pattern that waits for either a DAP 'stopped' event or adapter connection status, with timeout fallback. Replaces legacy behavior from ProxyManager.

## Key Components

### JsDebugLaunchBarrier Class (L12-119)
Implements `AdapterLaunchBarrier` interface with promise-based synchronization mechanism.

**Core Properties:**
- `awaitResponse: false` (L13) - indicates this barrier doesn't wait for response completion
- `promise: Promise<void>` (L19) - main synchronization primitive with external resolve/reject refs (L17-18)
- `settled: boolean` (L22) - prevents double resolution/rejection
- `timeoutHandle/adapterConnectedHandle` (L20-21) - manages async timeout operations

**Constructor (L24-41):**
- Sets up promise with external resolve/reject references
- Establishes timeout (default 5000ms) that warns and proceeds anyway
- Initializes cleanup-safe timeout handling

**Event Handlers:**
- `onRequestSent(requestId)` (L43-47) - logs launch request dispatch
- `onProxyStatus(status)` (L49-67) - triggers on 'adapter_connected' with 500ms delay
- `onDapEvent(event, body)` (L69-75) - resolves immediately on 'stopped' event
- `onProxyExit(code, signal)` (L77-85) - rejects barrier if proxy dies early

**Lifecycle Methods:**
- `waitUntilReady()` (L87-89) - returns the internal promise
- `dispose()` (L91-100) - cleans up timeout handles
- `resolveBarrier()/rejectBarrier()` (L102-118) - private settlement methods with cleanup

## Dependencies
- `@debugmcp/shared`: AdapterLaunchBarrier interface, ILogger
- `@vscode/debugprotocol`: DebugProtocol types for DAP events

## Architecture Patterns
- **Barrier Pattern**: Blocks execution until specific conditions are met
- **Promise Externalization**: Exposes resolve/reject outside promise constructor
- **Defensive Settling**: Guards against multiple resolution attempts
- **Resource Management**: Proper cleanup of timeout handles

## Critical Invariants
- Only resolves once via `settled` flag guard
- Always cleans up timeout handles on settlement
- Timeout fallback ensures non-blocking behavior (warns but proceeds)
- 500ms delay on adapter connection prevents race conditions

## Configuration Constants
- `DEFAULT_TIMEOUT_MS = 5000` (L4)
- `ADAPTER_CONNECTED_DELAY_MS = 500` (L5)
# packages/adapter-javascript/src/utils/js-debug-launch-barrier.ts
@source-hash: 20c78e632a524fd7
@generated: 2026-02-09T18:13:59Z

## Purpose
Implements a launch readiness barrier specifically for js-debug adapter, coordinating startup by waiting for either a 'stopped' DAP event or adapter connection confirmation with configurable timeout fallback.

## Key Components

**JsDebugLaunchBarrier Class (L12-120)**
- Implements `AdapterLaunchBarrier` interface from `@debugmcp/shared`
- Manages launch readiness through promise-based coordination
- Uses dual trigger mechanism: 'stopped' DAP event OR adapter connection + delay
- Built-in timeout protection with fallback resolution

**Core Properties (L13-22)**
- `awaitResponse: false` - indicates no response waiting required
- `promise/resolve/reject` - internal promise coordination machinery
- `timeoutHandle/adapterConnectedHandle` - timeout management
- `settled` - prevents double resolution/rejection

**Event Handlers**
- `onDapEvent()` (L69-76): Resolves on 'stopped' event, ignores event body
- `onProxyStatus()` (L49-67): Triggers on 'adapter_connected' status with 500ms delay
- `onProxyExit()` (L78-86): Rejects barrier if proxy exits prematurely
- `onRequestSent()` (L43-47): Logging only, no barrier logic

**Lifecycle Methods**
- `waitUntilReady()` (L88-90): Returns the internal promise
- `dispose()` (L92-101): Cleans up timeout handles
- `resolveBarrier()` (L103-110): Internal resolution with cleanup
- `rejectBarrier()` (L112-119): Internal rejection with cleanup

## Configuration Constants
- `DEFAULT_TIMEOUT_MS = 5000` (L4): Default launch timeout
- `ADAPTER_CONNECTED_DELAY_MS = 500` (L5): Delay after adapter connection

## Dependencies
- `@debugmcp/shared`: AdapterLaunchBarrier interface, ILogger
- `@vscode/debugprotocol`: DebugProtocol types for DAP events

## Architectural Patterns
- **Barrier Pattern**: Coordinates async operations until specific conditions met
- **Promise-based Coordination**: Single promise tracks multiple trigger conditions
- **Timeout Protection**: Fallback mechanism prevents indefinite blocking
- **Resource Cleanup**: Proper disposal of timeout handles prevents leaks
- **Early Settlement Protection**: `settled` flag prevents race conditions

## Critical Invariants
- Only resolves/rejects once due to `settled` flag checks
- Always cleans up timeout handles on disposal or settlement
- Adapter connection requires additional delay before resolution
- Proxy exit always causes rejection if not already settled
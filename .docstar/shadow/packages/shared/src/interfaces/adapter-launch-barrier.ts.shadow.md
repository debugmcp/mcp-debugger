# packages/shared/src/interfaces/adapter-launch-barrier.ts
@source-hash: d2e4a106273ed640
@generated: 2026-02-10T00:41:06Z

**Primary Purpose**: TypeScript interface defining a coordination mechanism between ProxyManager and debug adapters for customized DAP (Debug Adapter Protocol) request handling, particularly for language-specific launch synchronization.

**Core Interface**: `AdapterLaunchBarrier` (L9-49) - Contract for adapter-provided coordinators that decouple ProxyManager from specific adapter implementations while enabling custom launch behavior.

**Key Properties**:
- `awaitResponse` (L15) - Boolean flag controlling whether ProxyManager waits for DAP response or relies on barrier signaling

**Request Lifecycle Methods**:
- `onRequestSent(requestId)` (L21) - Pre-send request tracking hook
- `waitUntilReady()` (L42) - Promise-based readiness coordination mechanism
- `dispose()` (L48) - Resource cleanup handler

**Event Handlers**:
- `onProxyStatus(status, message)` (L26) - Raw proxy status notifications (e.g., "adapter_connected")
- `onDapEvent(event, body)` (L31) - DAP event processing with typed body parameter
- `onProxyExit(code, signal)` (L36) - Proxy termination notifications for fail-fast scenarios

**Dependencies**: 
- `@vscode/debugprotocol` - Provides `DebugProtocol.Event['body']` typing for DAP event handling

**Architectural Pattern**: Strategy pattern implementation allowing ProxyManager to delegate launch coordination logic to language-specific adapters without tight coupling. The barrier acts as a synchronization primitive where adapters can signal completion independently of DAP response timing.

**Critical Invariant**: When `awaitResponse` is false, the adapter must eventually resolve `waitUntilReady()` to prevent ProxyManager from hanging indefinitely.
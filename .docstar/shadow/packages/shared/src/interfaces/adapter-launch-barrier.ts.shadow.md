# packages/shared/src/interfaces/adapter-launch-barrier.ts
@source-hash: d2e4a106273ed640
@generated: 2026-02-09T18:14:05Z

## Primary Purpose
Defines the `AdapterLaunchBarrier` interface for customizing DAP (Debug Adapter Protocol) request handling in ProxyManager. Enables language-specific launch synchronization without tight coupling between ProxyManager and specific debug adapters.

## Core Interface
**AdapterLaunchBarrier (L9-49)**: Main interface providing coordination hooks for DAP request lifecycle management.

### Key Properties
- `awaitResponse` (L15): Boolean flag controlling whether ProxyManager waits for DAP response or relies on barrier signaling

### Request Lifecycle Methods
- `onRequestSent()` (L21): Pre-send hook for request tracking after requestId assignment
- `waitUntilReady()` (L42): Async method returning Promise<void> for readiness signaling

### Event Handling Methods
- `onProxyStatus()` (L26): Receives raw proxy status notifications (e.g., "adapter_connected")
- `onDapEvent()` (L31): Handles DAP events from proxy with optional body parameter
- `onProxyExit()` (L36): Processes proxy termination for fail-fast scenarios

### Resource Management
- `dispose()` (L48): Cleanup method for releasing timers and resources

## Dependencies
- `@vscode/debugprotocol`: Provides DebugProtocol.Event type for DAP event body typing (L1, L31)

## Architectural Pattern
Implements a coordinator pattern that decouples ProxyManager from adapter-specific launch logic. The barrier acts as an intermediary that can either delegate to standard DAP response handling (`awaitResponse: true`) or implement custom synchronization logic (`awaitResponse: false`).

## Key Design Decisions
- Uses readonly `awaitResponse` property to determine response handling strategy
- Separates concerns between request tracking, event handling, and resource management
- Provides comprehensive lifecycle hooks covering request initiation through proxy termination
- Enables fail-fast behavior through proxy exit notifications
# src/proxy/dap-proxy-request-tracker.ts
@source-hash: 2142dfc2592fe7db
@generated: 2026-02-10T01:19:00Z

## Request tracking utility for managing DAP request timeouts

This module provides two classes for managing Debug Adapter Protocol (DAP) request timeouts:

### Core Architecture

- **RequestTracker (L7-91)**: Base implementation that tracks pending requests with automatic timeout cleanup
- **CallbackRequestTracker (L96-129)**: Enhanced version that executes callbacks on timeout

### Key Dependencies

- `IRequestTracker` and `TrackedRequest` interfaces from `./dap-proxy-interfaces.js` (L5)

### RequestTracker Class (L7-91)

**Primary responsibility**: Track DAP requests with timeout management, ensuring requests don't hang indefinitely.

**Core state**:
- `pendingRequests`: Map storing active requests by ID (L8)
- `defaultTimeoutMs`: Default timeout value (30 seconds) (L9, L11)

**Key methods**:
- `track(requestId, command, timeoutMs)` (L18-37): Registers new request with timeout timer, auto-clears duplicates
- `complete(requestId)` (L42-48): Removes request and clears its timeout
- `clear()` (L53-58): Bulk cleanup of all pending requests
- `getPending()` (L63-65): Returns copy of pending requests map
- `getPendingCount()` (L70-72): Returns count of active requests
- `isPending(requestId)` (L77-79): Checks if specific request exists
- `getElapsedTime(requestId)` (L84-90): Calculates request age in milliseconds

**Timeout behavior**: When timeout triggers, request is silently removed from tracking (L23-29). Base class has no timeout callback mechanism.

### CallbackRequestTracker Class (L96-129)

**Purpose**: Extends RequestTracker to execute custom timeout handlers.

**Key differences**:
- Constructor requires `onTimeout` callback (L99-105)
- Overridden `track()` method calls `onTimeout(requestId, command)` when timeout occurs (L107-127)
- Same timeout cleanup behavior but with notification capability

### Usage Patterns

Both classes implement automatic request deduplication - tracking a request with existing ID clears the previous one first (L20, L109). This prevents timeout leak scenarios.

The `TrackedRequest` structure includes: requestId, command, timer handle, and timestamp for elapsed time calculations.

### Architectural Decision

Two-tier design allows for flexible timeout handling - base class for simple timeout cleanup, extended class for notification-based timeout handling (useful for error reporting, retry logic, etc.).
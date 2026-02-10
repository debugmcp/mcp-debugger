# src/proxy/dap-proxy-request-tracker.ts
@source-hash: 5e3d7b06eaa4c047
@generated: 2026-02-09T18:15:03Z

## Purpose
Request tracking utility for managing DAP (Debug Adapter Protocol) request timeouts in a proxy architecture. Provides timeout management for pending requests with automatic cleanup.

## Core Classes

### RequestTracker (L7-91)
Base implementation of `IRequestTracker` interface for managing request timeouts.

**Key Properties:**
- `pendingRequests` (L8): Map storing active tracked requests by ID
- `defaultTimeoutMs` (L9): Default timeout duration (30 seconds)

**Key Methods:**
- `track(requestId, command, timeoutMs?)` (L18-37): Registers new request with timeout timer, auto-clears existing requests with same ID
- `complete(requestId)` (L42-48): Marks request complete and cleans up timeout timer
- `clear()` (L53-58): Clears all pending requests and their timers
- `getPending()` (L63-65): Returns copy of pending requests map
- `getPendingCount()` (L70-72): Returns count of pending requests
- `isPending(requestId)` (L77-79): Checks if specific request is tracked
- `getElapsedTime(requestId)` (L84-90): Returns elapsed time since request started

### CallbackRequestTracker (L96-129)
Enhanced version extending `RequestTracker` with timeout callback functionality.

**Key Properties:**
- `onTimeout` (L97): Callback function invoked when requests timeout

**Key Methods:**
- `track()` (L107-127): Overrides parent to execute callback on timeout instead of silent cleanup

## Dependencies
- Imports `IRequestTracker` and `TrackedRequest` interfaces from `./dap-proxy-interfaces.js` (L5)

## Architecture Patterns
- Template method pattern: Base class provides structure, derived class customizes timeout behavior
- Map-based tracking with timer cleanup for memory management
- Defensive programming: Always clears existing requests before tracking new ones with same ID

## Key Behaviors
- Default 30-second timeout for all requests
- Automatic cleanup prevents memory leaks from abandoned requests
- Thread-safe request replacement (clears before adding)
- Timeout handling differs between classes: base class silently removes, callback version executes handler
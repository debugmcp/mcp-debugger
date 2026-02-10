# tests/test-utils/promise-tracker.ts
@source-hash: 8786e3cef8cf1332
@generated: 2026-02-09T18:15:11Z

## Promise Tracking Utility for Test Debugging

**Primary Purpose**: Test utility for tracking and debugging promise leaks in test suites by monitoring promise lifecycle and identifying unresolved or improperly cleaned up promises.

### Core Data Structures

- **TrackedPromise Interface (L5-12)**: Defines promise tracking metadata including ID, session, test name, creation timestamp, stack trace, and resolution status
- **activePromises Map (L15)**: Global registry mapping promise IDs to TrackedPromise objects 
- **sessionPromises Map (L18)**: Session-based grouping of promise IDs using Sets for efficient cleanup

### Key Functions

**Promise Lifecycle Management:**
- **trackPromise() (L23-44)**: Registers new promise with metadata capture, stack trace generation, and optional debug logging
- **resolvePromise() (L49-58)**: Marks promise as resolved without removing from tracking
- **untrackPromise() (L63-81)**: Complete cleanup - removes from both global and session maps with automatic session cleanup when empty

**Session Management:**
- **cleanupSession() (L86-93)**: Bulk cleanup of all promises for a specific session ID
- **clearAllTracking() (L128-131)**: Nuclear option - clears all tracking state

**Debugging & Reporting:**
- **reportLeakedPromises() (L98-123)**: Identifies and formats leak reports for unresolved or untracked promises with age calculation
- **getPromiseStats() (L136-163)**: Provides aggregate statistics including total, resolved/unresolved counts, and per-test breakdowns

### Architectural Patterns

- **Two-tier tracking**: Global promise registry with session-based grouping for efficient bulk operations
- **Debug-conditional logging**: All console output gated by `DEBUG_PROMISE_LEAKS` environment variable
- **Stack trace capture**: Uses `new Error().stack` for promise creation location tracking
- **Defensive programming**: Null-safe operations throughout with existence checks

### Usage Context

Designed for test environments to identify:
- Promises that never resolve/reject (blocking test completion)
- Resolved promises not properly cleaned up (memory leaks)
- Session-scoped promise management for test isolation

### Critical Invariants

- Promise IDs must be unique across sessions
- Session cleanup automatically removes empty session entries
- Stack traces captured at promise creation time for debugging
- Resolution status independent of cleanup status (resolved promises may still be tracked)
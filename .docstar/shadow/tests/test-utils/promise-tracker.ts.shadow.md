# tests/test-utils/promise-tracker.ts
@source-hash: 8786e3cef8cf1332
@generated: 2026-02-10T00:41:59Z

## Purpose
Test utility for debugging promise memory leaks by tracking promise lifecycle across test sessions. Helps identify unresolved promises or promises that weren't properly cleaned up after test completion.

## Key Data Structures

**TrackedPromise Interface (L5-12)**
- Core tracking object containing promise metadata: ID, session, test name, creation timestamp, stack trace, and resolution status

**Global State (L15-18)**
- `activePromises`: Map tracking all currently monitored promises by ID
- `sessionPromises`: Map grouping promise IDs by session for bulk cleanup

## Core Functions

**trackPromise() (L23-44)**
- Registers new promise for tracking with creation timestamp and stack trace
- Associates promise with session and test context
- Optional debug logging via `DEBUG_PROMISE_LEAKS` env var

**resolvePromise() (L49-58)**
- Marks tracked promise as resolved (but keeps it in tracking for cleanup verification)
- Does not remove from active tracking - cleanup still required

**untrackPromise() (L63-81)**
- Removes promise from all tracking structures
- Cleans up empty session entries automatically
- Final cleanup step after promise resolution and disposal

## Session Management

**cleanupSession() (L86-93)**
- Bulk cleanup utility that removes all promises associated with a test session
- Iterates through session's promise set and calls untrackPromise for each

## Debugging & Reporting

**reportLeakedPromises() (L98-123)**
- Scans active promises for leaks (unresolved or resolved but not cleaned)
- Returns detailed leak reports with stack traces, ages, and test context
- Distinguishes between unresolved promises vs resolved but uncleaned promises

**getPromiseStats() (L136-163)**
- Provides aggregated statistics: total/resolved/unresolved counts and per-test breakdown
- Useful for test suite health monitoring

**clearAllTracking() (L128-131)**
- Emergency cleanup that clears all tracking state
- Intended for test infrastructure cleanup

## Architecture Notes

- Uses two-level tracking (global + session-scoped) for flexible cleanup strategies
- Promise lifecycle: track → resolve → untrack (3-step process)
- Debug mode controlled by `DEBUG_PROMISE_LEAKS` environment variable
- Stack trace capture at creation time enables precise leak source identification
- Session-based grouping allows test framework integration for automatic cleanup
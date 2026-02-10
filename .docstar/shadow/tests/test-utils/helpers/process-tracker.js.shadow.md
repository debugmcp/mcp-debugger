# tests/test-utils/helpers/process-tracker.js
@source-hash: 4a8b14104bb32585
@generated: 2026-02-09T18:14:37Z

## Purpose
Test utility module that provides global process tracking and cleanup functionality to prevent orphaned processes during test execution. Maintains a singleton registry of spawned processes with automatic cleanup capabilities.

## Key Classes & Functions

### ProcessTracker (L9-118)
Main class that manages process lifecycle tracking with Map-based storage.

**Core Properties:**
- `processes` (L10): Map<pid, processEntry> storing tracked process metadata
- `cleanupTimeoutMs` (L11): 5-second timeout constant for cleanup operations

**Key Methods:**
- `register(process, name)` (L15-34): Adds process to tracker with PID validation, auto-cleanup on exit
- `unregister(pid)` (L38-42): Removes process from tracking registry
- `killProcess(pid, signal='SIGTERM')` (L46-68): Graceful termination with SIGKILL fallback
- `cleanupAll()` (L72-95): Bulk cleanup of all tracked processes with parallel execution
- `getCount()` (L99-101): Returns count of currently tracked processes
- `getTrackedProcesses()` (L105-111): Returns metadata array of tracked processes
- `reset()` (L115-117): Clears registry for test isolation

## Dependencies
- `createLogger` from `../../../src/utils/logger.js` (L7): Provides debug/info/warn/error logging
- Uses native Node.js process APIs and Promise-based async operations

## Architectural Patterns

### Singleton Pattern
Exports singleton instance `processTracker` (L120) for global state management across test suite.

### Event-Driven Cleanup
Automatically registers exit listeners on tracked processes (L29-33) for self-cleanup when processes terminate normally.

### Graceful Degradation
Kill operations use progressive escalation: SIGTERM → wait 100ms → SIGKILL (L54-59) to allow graceful shutdown.

## Critical Invariants
- Only processes with valid PIDs are tracked (L16-19)
- Process entries contain: pid, name, process reference, startTime (L20-25)
- Map is cleared after bulk cleanup operations (L94)
- Defensive error handling prevents cleanup failures from propagating (L64-67)

## Usage Context
Designed for test teardown phases to ensure no background processes survive test completion, preventing resource leaks and test isolation issues.
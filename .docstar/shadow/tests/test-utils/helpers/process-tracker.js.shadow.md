# tests/test-utils/helpers/process-tracker.js
@source-hash: 4a8b14104bb32585
@generated: 2026-02-10T00:41:28Z

## Purpose
Test utility module that tracks spawned processes during test execution and provides cleanup mechanisms to prevent orphaned processes. Uses a singleton pattern to maintain global process registry across test suites.

## Key Classes

### ProcessTracker (L9-118)
Core class managing process lifecycle tracking with the following responsibilities:

**Properties:**
- `processes` (L10): Map storing tracked processes by PID
- `cleanupTimeoutMs` (L11): Cleanup timeout configuration (5 seconds)

**Key Methods:**
- `register(process, name)` (L15-34): Adds process to tracking registry, auto-registers exit handler for cleanup
- `unregister(pid)` (L38-42): Removes process from registry when it exits normally  
- `killProcess(pid, signal)` (L46-68): Terminates specific process with graceful shutdown attempt (SIGTERM → SIGKILL fallback)
- `cleanupAll()` (L72-95): Bulk cleanup of all tracked processes with parallel termination and result reporting
- `getCount()` (L99-101): Returns number of tracked processes
- `getTrackedProcesses()` (L105-111): Returns process metadata (PID, name, age) for monitoring
- `reset()` (L115-117): Clears registry for test isolation

## Dependencies
- `createLogger` from `../../../src/utils/logger.js` (L7): Provides structured logging with 'test:process-tracker' namespace

## Exports
- `processTracker` (L120): Singleton instance for global process tracking
- `ProcessTracker` (L122): Class export for testing and custom instances

## Architecture Patterns
- **Singleton Pattern**: Global process tracker instance ensures consistent state across test modules
- **Auto-cleanup**: Processes self-unregister via exit event handlers to prevent memory leaks
- **Graceful Termination**: Two-stage kill process (SIGTERM → wait → SIGKILL) for clean shutdown
- **Parallel Processing**: Bulk cleanup uses Promise.all for efficient concurrent process termination

## Critical Behavior
- Process registration requires valid PID (L16-19)
- Auto-unregistration on process exit prevents stale entries (L29-33)
- 100ms grace period between SIGTERM and SIGKILL (L55)
- Comprehensive logging for debugging process lifecycle issues
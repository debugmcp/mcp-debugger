# tests/test-utils/helpers/process-tracker.d.ts
@source-hash: 2b7483936c39e377
@generated: 2026-02-09T18:14:35Z

## Purpose
TypeScript declaration file for a global process tracker utility designed for test environments. Provides centralized management of spawned child processes to prevent orphaned processes after test completion.

## Key Types and Interfaces

**TrackedProcess Interface (L8-17)**
- `pid: number` - Process identifier
- `name: string` - Human-readable process name for debugging
- `process: ChildProcess | ProcessLike` - Either Node.js ChildProcess or minimal process-like object with kill capability
- `startTime: number` - Timestamp for process age tracking

## Core Class

**ProcessTracker Class (L18-53)**
- `processes` (L19) - Private registry of tracked processes
- `cleanupTimeoutMs` (L20) - Private timeout configuration for cleanup operations

### Registration Methods
- `register(process, name)` (L24) - Adds process to tracking registry
- `unregister(pid)` (L28) - Removes process from registry (normal exit cleanup)

### Process Management
- `killProcess(pid, signal?)` (L32) - Terminates specific process with optional signal, returns success status
- `cleanupAll()` (L36) - Asynchronously terminates all tracked processes

### Inspection Methods
- `getCount()` (L40) - Returns number of currently tracked processes
- `getTrackedProcesses()` (L44-48) - Returns array of process info with computed age
- `reset()` (L52) - Clears all tracking state for test isolation

## Exports
- `processTracker` (L54) - Singleton instance for global use
- `ProcessTracker` (L55) - Class export for custom instances

## Dependencies
- `child_process.ChildProcess` (L7) - Node.js standard library for process management

## Architecture Notes
- Designed as singleton pattern for global process lifecycle management
- Dual-interface support allows tracking both native ChildProcess and mock/wrapper objects
- Age calculation enables timeout-based cleanup strategies
- Reset functionality supports test isolation patterns
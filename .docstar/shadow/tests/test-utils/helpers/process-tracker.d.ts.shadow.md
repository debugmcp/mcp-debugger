# tests/test-utils/helpers/process-tracker.d.ts
@source-hash: 2b7483936c39e377
@generated: 2026-02-10T00:41:24Z

**Purpose**: TypeScript declarations for a global process tracker utility that manages spawned child processes during test execution to prevent orphaned processes.

**Core Architecture**:
- **TrackedProcess Interface (L8-17)**: Defines structure for tracked processes with pid, name, process reference, and startTime timestamp
- **ProcessTracker Class (L18-53)**: Main singleton class managing process lifecycle with private process registry and cleanup timeout configuration

**Key Methods**:
- `register(process, name)` (L24): Adds new process to tracking registry
- `unregister(pid)` (L28): Removes process from registry when it exits normally
- `killProcess(pid, signal?)` (L32): Terminates specific process by PID with optional signal
- `cleanupAll()` (L36): Asynchronously terminates all tracked processes
- `getCount()` (L40): Returns number of currently tracked processes
- `getTrackedProcesses()` (L44-48): Returns array of process info with calculated age
- `reset()` (L52): Clears tracker state for test isolation

**Process Support**: Handles both Node.js ChildProcess instances and custom process-like objects with kill() method (L11-15).

**Export Pattern**: Provides both singleton instance `processTracker` (L54) and class constructor `ProcessTracker` (L55) for flexibility.

**Dependencies**: 
- Node.js `child_process` module for ChildProcess type (L7)
- Node.js signal types for process termination (L32)

**Usage Context**: Test utility for preventing process leaks in test suites by ensuring proper cleanup of spawned processes.
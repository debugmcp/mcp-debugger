# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/resource_tracker.py
@source-hash: b0099f5e2285fe24
@generated: 2026-02-09T18:11:15Z

## Purpose
Server process for tracking and cleaning up unlinked multiprocessing resources (shared memory segments, semaphores) to prevent system resource leaks. Implements a daemon process that monitors resource registration/unregistration via pipe communication and performs cleanup on process termination.

## Key Classes & Functions

### ResourceTracker (L58-201)
Main class managing the resource tracker daemon process lifecycle.

**Core State (L61-63):**
- `_lock`: Threading RLock for thread safety
- `_fd`: File descriptor for pipe communication with daemon
- `_pid`: Process ID of running daemon

**Key Methods:**
- `ensure_running()` (L94-160): Launches or verifies daemon process is alive. Handles reentrant call detection, process death recovery, and signal masking during spawn
- `_check_alive()` (L161-170): Validates daemon by sending PROBE message
- `register(name, rtype)` (L172-174): Registers resource for tracking
- `unregister(name, rtype)` (L176-178): Unregisters resource 
- `_send(cmd, name, rtype)` (L180-199): Core communication protocol - sends ASCII messages via pipe with 512-byte atomic write guarantee

### main(fd) (L209-269)
Entry point for daemon process. Ignores SIGINT/SIGTERM, reads registration commands from pipe, maintains resource cache, and performs cleanup on EOF.

## Global State & Configuration

**Module-level tracker instance (L202-206):**
- `_resource_tracker`: Singleton ResourceTracker instance
- Exported functions: `ensure_running`, `register`, `unregister`, `getfd`

**Cleanup function registry (L32-51):**
- `_CLEANUP_FUNCS`: Maps resource types to cleanup functions
- POSIX-specific: semaphore cleanup via `_multiprocessing.sem_unlink`, shared memory via `_posixshmem.shm_unlink`

## Communication Protocol
- ASCII messages: `{CMD}:{name}:{rtype}\n`
- Commands: REGISTER, UNREGISTER, PROBE
- 512-byte message limit for atomic writes
- Daemon terminates on EOF (all processes closed pipe)

## Architecture Patterns
- Singleton pattern for global tracker instance
- Daemon process pattern with signal isolation
- Pipe-based IPC with atomic messaging
- Reentrant call detection to prevent garbage collection cycles
- Signal masking during process spawn to prevent race conditions

## Critical Constraints
- Thread safety via RLock with recursion detection
- Message atomicity requires ≤512 bytes
- Daemon ignores termination signals for reliable cleanup
- Resource leaks warned but handled gracefully on reentrant calls
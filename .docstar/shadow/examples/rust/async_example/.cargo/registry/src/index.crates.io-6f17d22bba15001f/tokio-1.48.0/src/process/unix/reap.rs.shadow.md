# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/unix/reap.rs
@source-hash: 62868319849b8482
@generated: 2026-02-09T18:03:04Z

## Primary Purpose
Unix-specific child process reaping orchestrator that manages waiting for process completion by coordinating signal delivery (SIGCHLD) with polling for exit status. Handles orphaned processes during cleanup.

## Key Components

### Reaper<W, Q, S> struct (L16-24)
Generic wrapper around a process waiter that orchestrates:
- `inner`: Optional process waiter implementing `Wait` trait
- `orphan_queue`: Queue for processes that become orphaned during drop
- `signal`: Signal stream for SIGCHLD notifications

### Core Methods
- `new()` (L43-49): Constructor taking waiter, orphan queue, and signal stream
- `inner()` (L51-53): Safe access to inner waiter with panic on None
- `inner_mut()` (L55-57): Mutable access to inner waiter with panic on None

### Future Implementation (L60-105)
Implements async waiting via polling loop:
1. Registers interest in next SIGCHLD signal BEFORE checking process status
2. Attempts to wait on child process via `try_wait()`
3. Returns Ready(status) if process has exited
4. Returns Pending if signal interest was registered successfully
5. Continues loop if signal was already delivered

**Critical Race Condition Prevention**: Signal registration happens before status check to prevent deadlock where child exits after status poll but before signal registration.

### Trait Implementations
- `Deref` (L26-36): Delegates to inner waiter
- `Kill` (L107-115): Forwards kill operations to inner waiter  
- `Drop` (L117-130): Attempts final reap; moves unreaped processes to orphan queue

## Dependencies
- `crate::process::imp::orphan::{OrphanQueue, Wait}`: Orphan process management
- `crate::process::kill::Kill`: Process termination interface
- `crate::signal::unix::InternalStream`: SIGCHLD signal stream

## Critical Invariants
- Inner waiter must exist until drop (panics on None access)
- Signal registration must precede process status check to prevent race conditions
- Unreaped processes must be transferred to orphan queue during drop cleanup

## Test Coverage (L132-298)
Comprehensive test suite with mock implementations verifying:
- Async polling behavior with signal coordination
- Kill operation forwarding  
- Drop behavior for both successful reaping and orphan enqueueing
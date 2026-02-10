# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/unix/orphan.rs
@source-hash: 6d36ee9fb65fda80
@generated: 2026-02-09T18:03:09Z

## Primary Purpose
Unix-specific orphaned process reaper for Tokio's async process module. Manages a queue of child processes that have been detached from their parent and ensures they are properly waited on to prevent zombie processes.

## Key Components

### Wait Trait (L9-15)
Core abstraction for process waiting operations:
- `id()`: Returns process identifier for diagnostics
- `try_wait()`: Non-blocking attempt to wait for process exit

Blanket implementation for `&mut T` (L17-25) enables working with mutable references.

### OrphanQueue Trait (L28-31) 
Interface for enqueueing orphaned processes:
- `push_orphan()`: Adds orphan to reaping queue

Blanket implementation for `&O` (L33-37) enables working with references.

### OrphanQueueImpl (L41-111)
Primary implementation managing orphaned processes:
- `sigchild`: Mutex-protected SIGCHLD signal receiver for notifications
- `queue`: Mutex-protected vector storing orphaned processes
- `new()`: Constructor with conditional const support based on Mutex capabilities (L47-63)
- `push_orphan()`: Thread-safe orphan enqueueing (L70-75)
- `reap_orphans()`: Main reaping logic with lazy SIGCHLD registration (L79-110)

### Core Reaping Logic
`drain_orphan_queue()` (L113-130): Iterates through queue in reverse, calling `try_wait()` on each orphan. Removes processes that have exited or errored (invalid PIDs, already reaped).

## Key Patterns

**Lazy Signal Registration**: SIGCHLD listener only initialized when orphans exist in queue
**Lock Contention Avoidance**: Uses `try_lock()` to avoid blocking if another thread is draining
**Error Resilience**: Treats wait errors as completion (invalid PIDs, already reaped processes)
**Reverse Iteration**: Drains queue backwards to avoid index shifting during removal

## Dependencies
- `crate::loom::sync::Mutex`: Thread-safe synchronization primitive
- `crate::runtime::signal::Handle`: Signal driver integration
- `crate::signal::unix::signal_with_handle`: SIGCHLD signal registration
- `crate::sync::watch`: Change notification channel

## Test Module (L132-334)
Comprehensive test suite with mock implementations:
- `MockQueue`: Test double for OrphanQueue
- `MockWait`: Configurable Wait implementation for testing various scenarios
- Tests cover signal handling, lock contention, lazy registration, and error conditions

## Critical Invariants
- Orphan processes must eventually be reaped to prevent zombie accumulation
- SIGCHLD registration is deferred until orphans exist
- Lock acquisition failures are safely handled without data loss
- Process wait errors indicate completion and trigger removal
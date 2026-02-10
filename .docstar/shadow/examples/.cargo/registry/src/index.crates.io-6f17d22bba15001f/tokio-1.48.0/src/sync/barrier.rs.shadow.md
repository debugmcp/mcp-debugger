# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/barrier.rs
@source-hash: a355e871afa6143c
@generated: 2026-02-09T18:06:47Z

## Primary Purpose
Asynchronous barrier synchronization primitive for coordinating multiple Tokio tasks to wait until all reach a rendezvous point before continuing execution together.

## Core Architecture

### Main Types
- **`Barrier` (L42-48)**: Primary synchronization primitive using watch channels for coordination
  - `state: Mutex<BarrierState>`: Protected mutable state with arrival tracking
  - `wait: watch::Receiver<usize>`: Broadcast receiver for wake notifications
  - `n: usize`: Required number of tasks for barrier release
  - Optional tracing span for observability

- **`BarrierState` (L51-55)**: Internal state management
  - `waker: watch::Sender<usize>`: Broadcasts generation updates to wake waiters
  - `arrived: usize`: Count of tasks that have reached current barrier
  - `generation: usize`: Monotonic counter preventing ABA problems across reuses

- **`BarrierWaitResult` (L203)**: Return value indicating leader status

### Key Methods

#### `Barrier::new(n)` (L63-111)
- Creates barrier for `n` tasks (converts 0 to 1 for std compatibility)
- Initializes watch channel for coordination
- Sets up tracing instrumentation if enabled

#### `Barrier::wait()` (L125-138) / `wait_internal()` (L139-198)
- **Critical Section (L149-182)**: Uses synchronous mutex for fast atomic operations
  - Increments arrival counter and captures current generation
  - If final task (`arrived == n`): becomes leader, broadcasts wake signal, resets state
  - Returns immediately with `BarrierWaitResult(true)` for leader
- **Wait Loop (L187-195)**: Non-leaders wait for watch channel updates
  - Loops until generation advances (handles spurious wakes)
  - Returns `BarrierWaitResult(false)` for followers

## Synchronization Pattern
Uses **generation-based coordination** to handle reusable barriers:
1. Each barrier use gets unique generation number
2. Leader broadcasts generation to wake all waiters
3. Prevents race conditions when barrier is reused immediately

## Dependencies
- `crate::sync::watch`: Core broadcast mechanism for task coordination
- `crate::loom::sync::Mutex`: Loom-compatible mutex for testing/verification
- Optional tracing integration for observability

## Critical Invariants
- Exactly one task becomes leader per barrier cycle
- All tasks wait until `n` tasks arrive before proceeding
- Barrier state resets automatically for reuse
- Generation counter prevents cross-cycle confusion

## Cancel Safety
Explicitly **not cancel safe** - dropping a waiting future can cause indefinite blocking of other tasks since arrival count won't be decremented.
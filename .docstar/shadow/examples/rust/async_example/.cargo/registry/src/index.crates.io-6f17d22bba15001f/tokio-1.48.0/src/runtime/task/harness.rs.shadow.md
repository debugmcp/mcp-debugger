# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/harness.rs
@source-hash: 008c697f432197c6
@generated: 2026-02-09T18:03:21Z

## Purpose
Task execution harness for Tokio runtime - provides low-level task lifecycle management, polling, waking, and memory management with careful ref-counting and state transitions.

## Key Types

### Harness<T, S> (L17-51)
Typed raw task handle containing pointer to task cell. Provides safe access to task components:
- `cell`: NonNull pointer to Cell<T, S> containing task data
- Methods for accessing header (L32-38), state (L40-42), trailer (L44-46), core (L48-50)
- Created via `from_raw()` (L26-30) from raw Header pointer

### PollFuture enum (L492-497)
Return values for polling operations indicating next action:
- `Complete`: Task finished, needs completion handling
- `Notified`: Task yielded, should be rescheduled  
- `Done`: Polling complete, no further action
- `Dealloc`: Task should be deallocated

## Core Operations

### RawTask Implementation (L56-136)
Non-generic task operations to minimize binary bloat:

- `drop_reference()` (L57-61): Decrements ref-count, deallocates if zero
- `wake_by_val()` (L68-91): Consumes ref-count to wake task, handles Submit/Dealloc/DoNothing transitions
- `wake_by_ref()` (L96-109): Wakes without consuming ref-count
- `remote_abort()` (L118-128): Remotely cancels task via scheduler
- `try_set_join_waker()` (L133-135): Attempts to set completion notification waker

### Harness<T,S> Implementation (L138-418)
Generic task operations with scheduler integration:

**Polling & Execution:**
- `poll()` (L153-177): Main polling entry point, handles Notified/Complete/Dealloc outcomes
- `poll_inner()` (L193-232): Core polling logic with state transitions (Running→Idle/Complete)
- `poll_future()` (L521-557): Actual future polling with panic handling

**Lifecycle Management:**
- `shutdown()` (L240-251): Forcible task termination
- `complete()` (L331-388): Task completion handling with join waker notification
- `dealloc()` (L253-276): Memory deallocation with safety guarantees
- `release()` (L392-403): Scheduler release with ref-count management

**Join Handle Support:**
- `try_read_output()` (L281-285): Attempts to read completed task result
- `drop_join_handle_slow()` (L287-326): Complex join handle cleanup with output/waker dropping

## Critical Functions

### can_read_output() (L420-462)
Determines if task output is readable, manages join waker setting with optimization for same-task wakers.

### set_join_waker() (L464-490) 
Safely sets join waker following strict ownership rules, with rollback on failure.

### cancel_task() (L500-507)
Cancellation implementation - drops future with panic protection, stores cancellation error.

### panic_result_to_join_error() (L509-517)
Converts panic results to appropriate JoinError types (cancelled vs panicked).

## Memory Safety & Concurrency
- Extensive ref-counting with atomic state transitions
- Careful panic handling throughout with catch_unwind
- UnsafeCell-based shared access patterns
- Complex waker ownership rules (referenced in comments)
- ManuallyDrop usage for precise destructor control

## Dependencies
- Heavy integration with `crate::runtime::task::{core, state, waker}`
- Uses `std::task::{Context, Poll, Waker}` for Future protocol
- Panic handling via `std::panic`
- Atomic operations for state management

## Architecture Notes
- Separates generic and non-generic code paths for binary size optimization
- State machine-driven with explicit transition handling
- Designed for multi-threaded async runtime with Send/!Send task support
- Complex invariant maintenance around ref-counts and waker ownership
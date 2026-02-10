# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/state.rs
@source-hash: 438b7a0771891736
@generated: 2026-02-09T18:03:15Z

## Purpose
Task state management for Tokio's async runtime using atomic operations to coordinate task lifecycle, reference counting, and waker management. Implements a lock-free state machine for tasks with bitfield encoding of multiple state flags.

## Core Components

### State Structure (L6-8)
- `State`: Wrapper around `AtomicUsize` for atomic state transitions
- `Snapshot`: Immutable view of current state value for safe inspection

### State Bitfield Layout
- **Lifecycle bits (0-1)**: `RUNNING` (L17) and `COMPLETE` (L22) flags
- **Notification**: `NOTIFIED` flag (L28) tracks if task is queued for execution
- **Join handle**: `JOIN_INTEREST` (L31) and `JOIN_WAKER` (L34) for JoinHandle coordination
- **Cancellation**: `CANCELLED` flag (L37) for task abortion
- **Reference count**: Upper bits (L43-49) track task ownership

### Initial State (L61)
Tasks start with 3 references: OwnedTasks slot, scheduler notification, and JoinHandle. `JOIN_INTEREST` and `NOTIFIED` bits are set initially.

## Key State Transitions

### Runtime Execution Flow
- `transition_to_running()` (L117-145): Attempts to acquire running lock, handles cancellation
- `transition_to_idle()` (L151-181): Releases running lock, manages ref counts based on notification state
- `transition_to_complete()` (L183-192): Marks task completed using atomic XOR

### Notification Management
- `transition_to_notified_by_val()` (L215-250): Consumes ref count if no submission needed
- `transition_to_notified_by_ref()` (L253-278): Reference-based notification without consuming refs
- `transition_to_notified_and_cancel()` (L308-338): Sets cancelled bit and optionally notifies

### JoinHandle Coordination
- `drop_join_handle_fast()` (L365-384): Optimistic fast path for immediate JoinHandle drop
- `transition_to_join_handle_dropped()` (L390-426): Manages waker/output ownership on drop
- `set_join_waker()`/`unset_waker()` (L432-469): Waker lifecycle management

## Reference Counting (L481-516)
- `ref_inc()`: Relaxed increment with overflow protection
- `ref_dec()`/`ref_dec_twice()`: AcqRel decrement returning deallocation flag
- Uses upper bits with `REF_COUNT_SHIFT` offset

## Atomic Update Patterns
- `fetch_update_action()` (L518-538): Compare-and-swap loop with action return
- `fetch_update()` (L540-559): Standard CAS retry pattern
- All transitions use AcqRel/Acquire ordering for synchronization

## Snapshot Query Methods (L564-641)
State inspection methods: `is_idle()`, `is_running()`, `is_complete()`, `is_cancelled()`, `is_notified()`, `is_join_interested()`, `is_join_waker_set()`, `ref_count()`

## Platform-Specific Features
Conditional compilation for tracing support on Linux (L285-302) with `transition_to_notified_for_tracing()`.
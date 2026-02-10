# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/join.rs
@source-hash: d20cf461ed8c4537
@generated: 2026-02-09T18:03:13Z

## Primary Purpose
This file implements `JoinHandle<T>`, Tokio's equivalent of `std::thread::JoinHandle` for asynchronous tasks. It provides a handle for awaiting task completion, aborting tasks, and managing task lifecycle.

## Core Structure
- **JoinHandle<T> (L159-162)**: Main struct containing a `RawTask` handle and phantom data for type parameter T
  - Fields: `raw: RawTask`, `_p: PhantomData<T>`
  - Represents ownership of a spawned task's completion result

## Key Methods

### Task Management
- **new() (L172-177)**: Internal constructor creating handle from RawTask
- **abort() (L223-225)**: Cancels the associated task via `raw.remote_abort()`
- **is_finished() (L254-257)**: Checks completion status by reading task state
- **abort_handle() (L303-306)**: Creates detached `AbortHandle` for remote cancellation
- **id() (L312-315)**: Returns unique task identifier

### Async Integration
- **Future::poll() (L323-351)**: Core async implementation
  - Handles cooperative scheduling with budget tracking (L328)
  - Uses unsafe vtable calls to read task output (L342-344)
  - Updates progress tracking on completion (L346-348)
- **set_join_waker() (L260-265)**: Internal waker management for task completion notification

### Resource Management
- **Drop::drop() (L355-361)**: Cleanup logic with fast/slow path optimization
  - Fast path via `drop_join_handle_fast()` (L356)
  - Falls back to `drop_join_handle_slow()` (L360)

## Safety & Threading
- **Send/Sync implementations (L165-166)**: Conditional on T: Send
- **Unwind safety (L168-169)**: Implements UnwindSafe and RefUnwindSafe
- **Pin safety**: Implements Unpin (L318)

## Key Dependencies
- **RawTask**: Low-level task representation and vtable interface
- **Header**: Task metadata access for ID and state management
- **Cooperative scheduling**: Integration with Tokio's task budgeting system

## Architectural Patterns
- **Type erasure**: Uses unsafe vtable calls with `*mut ()` for generic output handling
- **Reference counting**: Increments task references for abort handles
- **State machine**: Task completion tracked via atomic state in header
- **Detachment semantics**: Dropping handle detaches task but doesn't cancel it

## Critical Invariants
- Task continues running after JoinHandle drop (detachment, not cancellation)
- Output type T must match actual task return type for safe vtable calls
- Waker notifications ensure proper async awakening on task completion
- spawn_blocking tasks cannot be aborted via this mechanism
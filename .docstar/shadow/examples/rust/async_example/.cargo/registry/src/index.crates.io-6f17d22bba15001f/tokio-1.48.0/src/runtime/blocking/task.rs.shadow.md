# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/blocking/task.rs
@source-hash: ade233c22540105b
@generated: 2026-02-09T18:03:02Z

## Purpose
Tokio runtime adapter that converts blocking functions into futures that execute immediately on first poll.

## Key Components

**BlockingTask<T> (L6-8)**: Wrapper struct containing an `Option<T>` function that converts blocking operations into futures.
- `func: Option<T>` - Holds the blocking function until execution, consumed on first poll

**BlockingTask::new() (L12-14)**: Constructor that wraps a function in the task wrapper.

**Unpin implementation (L18)**: Explicitly implements `Unpin` since the closure `F` is never pinned.

**Future implementation (L20-44)**: Core async adapter with constraints:
- `T: FnOnce() -> R + Send + 'static` - Function must be callable once and thread-safe
- `R: Send + 'static` - Return type must be thread-safe
- `poll()` method (L27-43) executes the function immediately on first call

## Critical Behavior

**Single execution guarantee**: Function is consumed via `take()` (L30-32) with panic on subsequent polls, ensuring the blocking operation runs exactly once.

**Cooperative scheduling bypass**: Calls `coop::stop()` (L40) to disable Tokio's cooperative task budgeting, allowing blocking tasks to run without yield points. This prevents interference with nested task execution within blocking operations.

**Immediate completion**: Always returns `Poll::Ready` (L42), never `Poll::Pending`, making this a synchronous-to-async adapter rather than a true async primitive.

## Architecture Notes

This is specifically designed for Tokio's blocking task pool where CPU-bound or blocking I/O operations need to run on dedicated threads but still integrate with the async runtime's Future interface.
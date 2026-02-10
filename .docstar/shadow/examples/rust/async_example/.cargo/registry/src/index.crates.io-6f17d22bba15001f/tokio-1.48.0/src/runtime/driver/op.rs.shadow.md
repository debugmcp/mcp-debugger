# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/driver/op.rs
@source-hash: fbbc3321bbeef259
@generated: 2026-02-09T18:03:08Z

## Purpose
Provides core async operation infrastructure for Tokio's io_uring runtime driver. Manages the complete lifecycle of asynchronous I/O operations from submission through completion or cancellation, implementing the `Future` trait for seamless integration with Tokio's async runtime.

## Key Types

### CancelData (L17-20)
Enum holding cancellation-specific data for different operation types (`Open`, `Write`). Used to safely cancel in-flight io_uring operations when futures are dropped.

### Lifecycle (L23-40)
State machine tracking io_uring operation progress:
- `Submitted`: Operation queued to io_uring
- `Waiting(Waker)`: Future awaiting completion with registered waker
- `Cancelled(CancelData)`: Operation abandoned but must complete before cleanup
- `Completed(cqueue::Entry)`: Operation finished with io_uring completion queue entry

### State (L42-46)
Future polling state machine:
- `Initialize(Option<Entry>)`: Holds submission queue entry before registration
- `Polled(usize)`: Active operation with driver index
- `Complete`: Future resolved and cleaned up

### Op<T: Cancellable> (L48-55)
Core async operation wrapper containing:
- `handle`: Runtime handle for driver access
- `state`: Current polling state
- `data`: Operation-specific data implementing `Cancellable`

### CqeResult (L94-96)
Wrapper converting raw io_uring completion queue entries to `io::Result<u32>`.

## Key Traits

### Completable (L111-114)
Converts completion queue results to operation-specific output types via `complete()` method.

### Cancellable (L117-119)
Extracts cancellation data needed for safe operation cleanup via `cancel()` method.

## Critical Implementation Details

### Future::poll Implementation (L126-186)
Three-phase state machine:
1. **Initialize**: Registers operation with driver, transitions to `Polled`
2. **Polled**: Checks completion status, manages waker updates, handles completion
3. **Complete**: Panics on re-polling (future contract violation)

### Drop Implementation (L76-90)
Ensures proper cleanup:
- `Complete`: No-op (already cleaned)
- `Polled`: Cancels operation via driver
- `Initialize`: No cleanup needed (never submitted)

### Safety Requirements
- `new()` method (L62) requires caller to ensure entry parameters remain valid for operation duration
- `register_op()` call (L136) relies on entry validity guarantee

## Dependencies
- `io_uring`: Low-level io_uring bindings for Linux async I/O
- `crate::runtime::Handle`: Tokio runtime access
- Operation-specific types: `Open`, `Write` from io_uring module

## Architecture Notes
- Tight integration with Tokio's driver layer for operation lifecycle management
- Memory safety through RAII patterns and explicit state transitions
- Waker optimization to avoid unnecessary wake-ups during polling
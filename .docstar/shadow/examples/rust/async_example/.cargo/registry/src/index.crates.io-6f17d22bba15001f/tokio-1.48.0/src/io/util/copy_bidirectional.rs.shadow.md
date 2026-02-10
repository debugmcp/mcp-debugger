# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/copy_bidirectional.rs
@source-hash: 6859e477b9e2f18c
@generated: 2026-02-09T18:02:47Z

## Primary Purpose
Implements bidirectional asynchronous data copying between two streams, enabling concurrent data transfer in both directions until EOF is reached on both streams.

## Key Components

### TransferState Enum (L10-14)
State machine for tracking transfer progress:
- `Running(CopyBuffer)` - Active transfer using internal buffer
- `ShuttingDown(u64)` - EOF reached, shutting down writer, stores bytes transferred
- `Done(u64)` - Transfer complete, stores final byte count

### transfer_one_direction Function (L16-43)
Core state machine executor for unidirectional transfer:
- Manages single direction copy using `CopyBuffer.poll_copy()`
- Handles graceful shutdown via `poll_shutdown()` when EOF detected
- Returns `Poll<io::Result<u64>>` with total bytes transferred
- Generic over `A, B: AsyncRead + AsyncWrite + Unpin + ?Sized`

### Public API Functions

#### copy_bidirectional (L75-87)
Main public interface using default 8KB buffers:
- Delegates to `copy_bidirectional_impl()` with default buffer sizes
- Returns `(u64, u64)` tuple: (a→b bytes, b→a bytes)

#### copy_bidirectional_with_sizes (L94-111)
Variant allowing custom buffer sizes for each direction

### copy_bidirectional_impl (L113-137)
Core implementation using `poll_fn` for concurrent execution:
- Creates two `TransferState::Running` instances for each direction
- Uses `transfer_one_direction()` to drive both transfers concurrently
- Waits for both directions to complete before returning results

## Dependencies
- `CopyBuffer` from `super::copy` - handles buffered async copying
- Standard async traits: `AsyncRead`, `AsyncWrite`
- Tokio utilities: `poll_fn`, `ready!` macro

## Key Patterns
- State machine pattern for transfer lifecycle management
- Concurrent bidirectional operation using single poll function
- Graceful shutdown coordination between read/write streams
- Generic design supporting any streams implementing required traits

## Critical Invariants
- Both directions must complete (reach `Done` state) for function to return
- EOF on one stream triggers shutdown of corresponding writer
- Bytes are accurately tracked through all state transitions
- No data loss during normal operation (errors may cause data loss as documented)
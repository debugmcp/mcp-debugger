# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/write_all.rs
@source-hash: 70dd0ce0777cbaf5
@generated: 2026-02-09T18:02:50Z

## Purpose
Implements an asynchronous write_all operation that ensures all bytes from a buffer are written to an AsyncWrite stream. This is a utility function that handles partial writes by repeatedly calling the underlying writer until the entire buffer is consumed.

## Key Components

### WriteAll Struct (L14-20)
Pin-projected future struct containing:
- `writer`: Mutable reference to the AsyncWrite implementor
- `buf`: Byte slice to be written
- `_pin: PhantomPinned`: Makes future `!Unpin` for async trait compatibility

### Constructor Function (L23-32) 
`write_all<'a, W>()` creates a WriteAll future instance with writer and buffer references.

### Future Implementation (L34-55)
Core async logic in `poll()` method:
- **Write Loop (L42-51)**: Continuously attempts to write remaining buffer data
- **Partial Write Handling (L43-47)**: Uses `ready!` macro to handle pending writes, advances buffer slice by bytes written
- **Zero-Write Detection (L48-50)**: Returns `WriteZero` error if no progress is made
- **Completion (L53)**: Returns success when buffer is fully consumed

## Dependencies
- `pin_project_lite`: For safe pin projection of struct fields
- `tokio::io::AsyncWrite`: Core async write trait
- Standard library futures and I/O primitives

## Architecture Patterns
- **Pin Projection**: Uses `pin_project!` macro for safe field access in pinned futures  
- **Ready Polling**: Employs `ready!` macro for proper async state machine handling
- **Buffer Advancement**: Uses `mem::take` and slice splitting for zero-copy buffer progression

## Critical Invariants
- Must write all bytes or return error - no partial completion allowed
- Handles `WouldBlock` transparently through ready! macro
- Guarantees forward progress or explicit failure via WriteZero error
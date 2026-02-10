# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/repeat.rs
@source-hash: 5f240ed98ebf5c45
@generated: 2026-02-09T18:02:46Z

**Primary Purpose**: Provides an async reader that infinitely repeats a single byte, serving as Tokio's asynchronous equivalent to `std::io::Repeat`.

**Key Components**:

- `Repeat` struct (L22-24): Simple wrapper containing a single `u8` byte value to repeat
- `repeat()` function (L47-49): Constructor that creates a `Repeat` instance with the specified byte
- `AsyncRead` implementation (L52-64): Core async reading logic that fills buffers with the repeated byte

**Implementation Details**:

The `poll_read` method (L54-63) implements the async reading behavior:
- Uses `trace_leaf` (L59) for tokio's internal tracing
- Calls `poll_proceed_and_make_progress` (L60) to handle async coordination and progress tracking
- Fills the entire remaining buffer space with the repeated byte via `buf.put_bytes()` (L61)
- Always returns `Poll::Ready(Ok(()))` since operation never blocks

**Dependencies**:
- `bytes::BufMut` for buffer operations
- `crate::io::util::poll_proceed_and_make_progress` for async progress coordination
- `crate::io::{AsyncRead, ReadBuf}` for async reading traits
- Standard library types for async polling

**Architectural Patterns**:
- Wrapped in `cfg_io_util!` macro (L10) for conditional compilation
- Implements `AsyncRead` trait for seamless integration with Tokio's async I/O ecosystem
- Uses pinning pattern with `Pin<&mut Self>` for safe async operations
- Non-blocking design - always ready to read

**Key Invariant**: The reader never fails and never blocks, always filling the requested buffer space with the configured byte value.

**Testing**: Includes `assert_unpin()` test (L71-72) verifying the type implements `Unpin` trait as expected.
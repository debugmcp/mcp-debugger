# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_exact.rs
@source-hash: fce472d60df0d4e9
@generated: 2026-02-09T18:02:48Z

**Primary Purpose**: Implements a utility future for reading exactly enough bytes to fill a buffer from an `AsyncRead` source, failing if EOF is encountered before the buffer is completely filled.

**Key Components**:
- `read_exact()` function (L16-25): Constructor that creates a `ReadExact` future from a mutable reference to an `AsyncRead` reader and a mutable byte buffer
- `ReadExact` struct (L34-40): A pinned future containing a reader reference, a `ReadBuf`, and a `PhantomPinned` marker to make it `!Unpin`
- `eof()` helper (L43-45): Creates an `UnexpectedEof` error for early termination scenarios
- `Future` implementation (L47-69): Core polling logic that repeatedly reads until buffer is full or EOF error

**Architecture & Patterns**:
- Uses `pin_project_lite` macro for safe projection of pinned fields
- Implements `!Unpin` via `PhantomPinned` for async trait compatibility
- Follows tokio's standard future pattern with `ready!` macro for async state management

**Critical Behavior**:
- Poll loop (L56-67) continues reading until `buf.remaining() == 0`
- EOF detection (L61-63): Returns error if no progress made (`remaining()` unchanged after read)
- Success condition (L65): Returns `Ok(capacity)` when buffer is completely filled
- Uses `ReadBuf` wrapper for efficient buffer management

**Dependencies**:
- `crate::io::{AsyncRead, ReadBuf}` - Core async I/O traits and buffer utilities
- `pin_project_lite` - For safe field projection in pinned structs
- Standard library futures/async machinery

**Invariants**:
- Buffer must be completely filled or error returned (no partial success)
- Reader must be `AsyncRead + Unpin + ?Sized`
- Future is `!Unpin` due to `PhantomPinned` field
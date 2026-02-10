# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/lines.rs
@source-hash: 413af90f004dacf7
@generated: 2026-02-09T18:02:51Z

## Lines Async Reader - Line-by-Line Stream Iterator

**Primary Purpose:** Provides async line-by-line reading from buffered async readers, handling platform-specific line endings (CRLF/LF).

### Core Structure
- `Lines<R>` struct (L23-29): Async iterator wrapper around `AsyncBufRead` readers
  - `reader: R` (L25): Pinned underlying async buffered reader
  - `buf: String` (L26): Reusable string buffer for constructed lines
  - `bytes: Vec<u8>` (L27): Raw byte buffer for reading operations
  - `read: usize` (L28): Tracking field for partial read state

### Key Functions
- `lines<R>()` (L32-42): Constructor factory function creating new `Lines` instance with empty buffers
- `next_line()` (L69-73): High-level async method returning `Option<String>` for next line or None at EOF
- `poll_next_line()` (L112-134): Core polling implementation handling line extraction and normalization
  - Uses `read_line_internal()` for actual reading (L118)
  - Normalizes line endings by stripping `\n` and `\r` (L125-131)
  - Returns owned strings via `mem::take()` (L133)

### Reader Access Methods (L75-91)
- `get_mut()`: Mutable reference to underlying reader
- `get_ref()`: Immutable reference to underlying reader  
- `into_inner()`: Consumes wrapper, returns reader (loses buffered data)

### Key Dependencies
- `read_line_internal()` from `crate::io::util::read_line` - performs actual async reading
- `pin_project_lite` - enables safe pinning projection for async operations
- Requires `R: AsyncBufRead` constraint for buffered reading capability

### Architectural Patterns
- **Pin Projection**: Uses `pin_project!` macro for safe async field access
- **Polling State Machine**: Implements standard async polling pattern with `Poll<Result<Option<T>>>`
- **Buffer Reuse**: Reuses internal string buffer across calls for efficiency
- **Cancellation Safety**: Explicitly documented as cancellation-safe

### Critical Invariants
- `*me.read == 0` after successful `read_line_internal()` call (L119 debug assertion)
- Buffer state reset between line reads via `mem::take()`
- Line ending normalization always strips trailing `\n` first, then `\r` if present

### Usage Context
Part of Tokio's async I/O utilities, typically created via `AsyncBufReadExt::lines()` method. Can be converted to `Stream` via external `LinesStream` wrapper.
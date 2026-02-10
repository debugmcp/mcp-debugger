# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/stderr.rs
@source-hash: 608d354f0907260b
@generated: 2026-02-09T18:06:35Z

**Primary Purpose**: Provides async wrapper for standard error stream in Tokio runtime

**Key Components**:

- `Stderr` struct (L37-40): Async handle to stderr wrapped with platform-specific UTF-8 handling
  - Field `std`: `SplitByUtf8BoundaryIfWindows<Blocking<std::io::Stderr>>` for proper encoding on Windows
  - Wraps synchronous stderr in blocking executor for async operation

- `stderr()` function (L68-77): Factory function returning new `Stderr` handle
  - Creates blocking wrapper using unsafe constructor with documented safety invariant
  - Applies UTF-8 boundary splitting for Windows compatibility

**Trait Implementations**:

- `AsyncWrite` (L115-134): Core async write functionality
  - `poll_write()` (L116-122): Delegates to wrapped implementation
  - `poll_flush()` (L124-126): Delegates flush operations
  - `poll_shutdown()` (L128-133): Delegates shutdown operations
  - All methods forward to the wrapped `std` field

**Platform-Specific Code**:

- Unix module (L80-97): File descriptor access via `AsRawFd` and `AsFd` traits
  - Methods delegate directly to `std::io::stderr()`, bypassing wrapper
- Windows module (L99-113): Handle access via `AsRawHandle` and `AsHandle` traits
  - Similar delegation pattern for Windows handles

**Key Dependencies**:
- `blocking::Blocking`: Executes sync I/O in thread pool
- `stdio_common::SplitByUtf8BoundaryIfWindows`: Windows UTF-8 handling
- Platform-specific I/O traits for raw handle/fd access

**Important Constraints**:
- Concurrent write safety: Individual writes are atomic, but `write_all` operations may be split
- Cross-platform encoding handled automatically
- Unsafe code limited to `Blocking::new()` construction with documented safety invariant
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/mod.rs
@source-hash: 6a19a5edf9260f81
@generated: 2026-02-09T18:02:52Z

## Purpose
Module definition file for Tokio's async I/O utilities. Acts as the central export hub for all async I/O extension traits, types, and utility functions. The entire module is conditionally compiled based on feature flags.

## Key Components

**Extension Traits (L4-14):**
- `AsyncBufReadExt` (L5) - Extension methods for buffered async readers
- `AsyncReadExt` (L8) - Extension methods for async readers  
- `AsyncSeekExt` (L11) - Extension methods for async seekable streams
- `AsyncWriteExt` (L14) - Extension methods for async writers

**Buffered I/O Types (L16-23):**
- `BufReader` (L17) - Buffered async reader wrapper
- `BufStream` (L20) - Bidirectional buffered stream
- `BufWriter` (L23) - Buffered async writer wrapper

**Utility Types (L25-76):**
- `Chain` (L26) - Chains two readers sequentially
- `Lines` (L43) - Line-by-line async iterator
- `DuplexStream`, `SimplexStream` (L46) - In-memory async streams
- `Empty` (L38) - Always-empty async reader
- `Repeat` (L65) - Repeating byte pattern reader
- `Sink` (L70) - Discards all written data
- `Split` (L73) - Split reader into two halves
- `Take` (L76) - Limits read length

**Copy Functions (L28-35):**
- `copy` (L29) - Basic async copy between reader/writer
- `copy_bidirectional`, `copy_bidirectional_with_sizes` (L32) - Bidirectional copying
- `copy_buf` (L35) - Buffered async copy

**Internal Modules (L48-83):**
Multiple private modules implementing core I/O operations like `read`, `write`, `read_exact`, `write_all`, etc. These contain the actual implementation logic for extension trait methods.

## Architecture Decisions

**Conditional Compilation:**
- Main functionality wrapped in `cfg_io_util!` macro (L3-103)
- Minimal fallback implementation in `cfg_not_io_util!` block (L105-112)
- Process-specific exports controlled by `cfg_process!` (L57-59, L106-111)
- Cooperative scheduling controlled by `cfg_coop!`/`cfg_not_coop!` (L90-102)

**Constants:**
- `DEFAULT_BUF_SIZE` (L88) - 8KB buffer size standard across buffered types

**Cooperative Scheduling:**
- `poll_proceed_and_make_progress` (L91-95, L99-101) - Handles task yielding for fairness, with different implementations based on coop feature

## Dependencies
- Core `std::task` for async polling primitives
- Internal `crate::task::coop` for cooperative scheduling when enabled
- Uses Tokio's conditional compilation macros for feature gating

## Key Patterns
- Re-export pattern: each submodule is imported and immediately re-exported publicly
- Feature-gated compilation ensures only needed functionality is included
- Cooperative scheduling abstraction allows runtime behavior changes based on compilation features
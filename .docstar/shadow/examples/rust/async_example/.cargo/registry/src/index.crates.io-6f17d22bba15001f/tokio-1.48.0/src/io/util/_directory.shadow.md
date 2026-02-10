# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/
@generated: 2026-02-09T18:16:20Z

## Overall Purpose and Responsibility

This module implements Tokio's async I/O utilities, providing high-level convenience APIs and buffered I/O types for asynchronous reading, writing, and stream operations. It serves as the primary interface layer that developers use instead of the low-level async traits, offering ergonomic methods similar to `std::io` but adapted for async/await patterns.

## Key Components and Organization

### Extension Traits (Primary Public API)
- **AsyncReadExt** - Convenience methods for `AsyncRead` types (chain, read, read_exact, numeric readers, take, etc.)
- **AsyncWriteExt** - Convenience methods for `AsyncWrite` types (write, write_all, flush, shutdown, numeric writers)
- **AsyncBufReadExt** - High-level buffered reading (read_until, read_line, split, lines)
- **AsyncSeekExt** - Seeking utilities (seek, rewind, stream_position)

### Buffered I/O Types
- **BufReader** - Adds read buffering to any `AsyncRead` with configurable capacity and seek support
- **BufWriter** - Adds write buffering to any `AsyncWrite` with flush-before-seek semantics
- **BufStream** - Bidirectional buffering combining `BufReader<BufWriter<RW>>`

### Stream Processing Utilities
- **Chain** - Sequential chaining of two readers with automatic transition
- **Lines** - Line-by-line async iteration with CRLF/LF normalization
- **Split** - Delimiter-based stream splitting into byte segments
- **Take** - Byte-limited reading wrapper

### Copy Operations
- **copy** - Streaming copy between reader/writer with internal buffering
- **copy_bidirectional** - Concurrent bidirectional copying for full-duplex streams
- **copy_buf** - Zero-allocation copy using reader's internal buffer

### Special-Purpose Types
- **Empty** - Always-EOF reader and data-discarding writer (async `/dev/null`)
- **Repeat** - Infinite single-byte repeating reader
- **Sink** - Data-discarding writer for testing/disposal
- **DuplexStream/SimplexStream** - In-memory bidirectional/unidirectional pipes

## Public API Surface and Entry Points

### Import Pattern
```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt, AsyncBufReadExt, AsyncSeekExt};
use tokio::io::{BufReader, BufWriter, copy, copy_bidirectional};
```

### Primary Usage Flow
1. **Extension Traits** - Developers import these to access convenience methods on any async I/O type
2. **Buffered Wrappers** - `BufReader`/`BufWriter` optimize small, frequent operations
3. **Copy Functions** - High-level data transfer between streams
4. **Utility Types** - Testing, stream processing, and specialized scenarios

## Internal Organization and Data Flow

### Future-Based Architecture
- Each convenience method returns a specific future type (e.g., `Read`, `Write`, `ReadExact`)
- Futures implement polling state machines with progress tracking and cancellation safety
- Pin projection ensures memory safety for self-referential async operations

### Buffer Management Strategy
- **Read Buffering**: Accumulates data from syscalls, serves small reads from buffer
- **Write Buffering**: Batches small writes, flushes on capacity or explicit request  
- **Optimization Patterns**: Large operations bypass buffers, read-ahead during backpressure

### Error Handling and Cancellation
- Most operations are cancellation-safe (documented per method)
- Buffered operations handle partial reads/writes gracefully
- EOF and error conditions properly propagate through future chains

## Important Patterns and Conventions

### Cooperative Scheduling
- All operations integrate with Tokio's cooperative task scheduler via `poll_proceed_and_make_progress`
- Conditional compilation supports minimal configurations without coop overhead

### Memory Efficiency
- Zero-copy optimizations where possible (copy_buf, buffer reuse)
- Adaptive allocation strategies prevent over-allocation
- Pin projection enables safe self-referential futures without `Box` overhead

### Conditional Compilation
- Entire module gated behind `cfg_io_util!` for minimal builds
- Process-specific features conditionally included
- Cooperative scheduling features toggleable

## Integration with Larger System

This module bridges Tokio's core async I/O traits (`AsyncRead`, `AsyncWrite`, `AsyncBufRead`, `AsyncSeek`) with application-level convenience APIs. It provides the async equivalent of `std::io` utilities while adding Tokio-specific optimizations like cooperative scheduling, advanced buffer management, and integration with the async runtime's task system.

The utilities support both high-throughput scenarios (via buffering and copy optimizations) and resource-constrained environments (via conditional compilation and adaptive algorithms), making them suitable for everything from network servers to embedded applications.
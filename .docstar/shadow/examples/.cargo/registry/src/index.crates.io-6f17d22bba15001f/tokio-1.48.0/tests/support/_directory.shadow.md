# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/support/
@generated: 2026-02-09T18:16:05Z

## Module Purpose
Test support utilities for Tokio's test suite, providing essential testing infrastructure for I/O operations, memory management, async streams, panic handling, and signal testing. This module encapsulates common testing patterns and safety-critical utilities needed across Tokio's comprehensive test coverage.

## Core Components

### I/O Testing Infrastructure
- **`io_vec.rs`**: Provides `IoBufs` wrapper for safe vectored I/O buffer advancement, enabling zero-copy buffer manipulation with lifetime safety guarantees
- **`leaked_buffers.rs`**: Implements `LeakedBuffers` for creating memory buffers with arbitrary lifetimes while maintaining RAII cleanup semantics, satisfying address sanitizers

### Async Testing Utilities  
- **`mpsc_stream.rs`**: Stream wrappers (`UnboundedStream`, `BoundedStream`) that convert Tokio MPSC channels into proper async streams via factory functions `unbounded_channel_stream()` and `channel_stream()`

### Test Environment Management
- **`panic.rs`**: Thread-safe panic testing harness with `test_panic()` function that captures panic source locations while preserving test environment integrity
- **`signal.rs`**: Unix signal sending utility via `send_signal()` for testing signal handling behavior in controlled test scenarios

## Public API Surface

### Primary Entry Points
- `IoBufs::new()`, `IoBufs::advance()`: Vectored I/O buffer management
- `LeakedBuffers::new()`, `LeakedBuffers::create()`: Controlled memory leaking for tests
- `unbounded_channel_stream()`, `channel_stream()`: MPSC-to-Stream conversion
- `test_panic()`: Panic detection and source location capture  
- `send_signal()`: Self-signaling for signal handler testing

## Internal Organization

### Safety Architecture
The module follows strict safety patterns:
- **Lifetime Management**: `io_vec.rs` and `leaked_buffers.rs` use careful lifetime parameterization to prevent use-after-free
- **Thread Safety**: `panic.rs` employs global mutex serialization for panic hook management
- **Controlled Unsafe**: Strategic use of unsafe blocks with clear invariants and panic boundaries

### Data Flow Patterns
- **RAII-based Resource Management**: All utilities follow RAII patterns for automatic cleanup
- **Zero-Copy Operations**: I/O utilities prioritize zero-copy buffer manipulation over data copying  
- **Stream Conversion**: Channel-to-stream adapters enable seamless integration with async stream ecosystems

## Testing Conventions
- All utilities are designed for test isolation and environment preservation
- Error handling favors panics over silent failures to ensure test correctness
- Cross-platform compatibility with Unix-specific signal handling contained to appropriate modules
- Memory safety prioritized through controlled lifetime management and address sanitizer compliance
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/sink.rs
@source-hash: 61b7093d86c75e41
@generated: 2026-02-09T18:02:50Z

## Purpose
Implements an async "sink" writer that discards all data written to it, serving as the async equivalent of `/dev/null` or `std::io::Sink`. Part of Tokio's IO utilities for testing and data disposal scenarios.

## Key Components

### Sink Struct (L19-21)
Zero-sized struct implementing AsyncWrite that consumes all data without storage. Contains only a unit field `_p` as a placeholder.

### sink() Function (L48-50)  
Factory function that creates a new Sink instance. Returns `Sink { _p: () }` - the primary public API for obtaining a sink writer.

### AsyncWrite Implementation (L53-78)
Core async writer implementation with three methods:
- `poll_write()` (L55-63): Always returns `Poll::Ready(Ok(buf.len()))` accepting full buffer
- `poll_flush()` (L66-70): No-op that always succeeds immediately  
- `poll_shutdown()` (L73-77): No-op that always succeeds immediately

All methods use `trace_leaf()` for tracing and `poll_proceed_and_make_progress()` for async runtime cooperation.

### Debug Implementation (L80-84)
Provides simple debug output showing "Sink { .. }" without exposing internal structure.

## Dependencies
- `crate::io::AsyncWrite`: Core async writing trait
- `crate::io::util::poll_proceed_and_make_progress`: Runtime cooperation utility
- `crate::trace::trace_leaf`: Async tracing support
- Standard library: `io`, `fmt`, `pin::Pin`, `task::{Context, Poll, ready}`

## Architecture Notes
- Zero-cost abstraction - no actual storage or processing overhead
- Always immediately ready for operations (no blocking)
- Useful for benchmarking, testing, and discarding unwanted output streams
- Implements Unpin as verified by test (L91-93)

## Usage Pattern
Typically used via `tokio::io::sink()` in scenarios requiring an AsyncWrite implementation that discards data, such as performance testing or routing unwanted output.
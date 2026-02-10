# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/support/mpsc_stream.rs
@source-hash: 00d48122fa2ccbf1
@generated: 2026-02-09T18:06:48Z

## Purpose
Test utility module that provides Stream wrappers around Tokio's MPSC channels, enabling stream-based consumption of channel messages in test scenarios.

## Key Components

### UnboundedStream<T> (L8-16)
Private wrapper struct that implements `Stream` trait for `UnboundedReceiver<T>`. The `poll_next` implementation (L13-15) directly delegates to the receiver's `poll_recv` method, converting the MPSC receiver into a proper async stream.

### BoundedStream<T> (L26-34) 
Private wrapper struct that implements `Stream` trait for bounded `Receiver<T>`. Identical implementation pattern to `UnboundedStream`, with `poll_next` (L31-33) delegating to the underlying receiver's `poll_recv`.

### Public Factory Functions
- `unbounded_channel_stream<T: Unpin>()` (L18-24): Creates unbounded MPSC channel pair, returns sender and stream-wrapped receiver
- `channel_stream<T: Unpin>(size: usize)` (L36-42): Creates bounded MPSC channel with specified buffer size, returns sender and stream-wrapped receiver

## Dependencies
- `tokio::sync::mpsc`: Core MPSC channel types
- `tokio_stream::Stream`: Stream trait for async iteration
- Standard library: `Pin`, `Context`, `Poll` for async polling

## Architecture Notes
Both stream implementations use `Pin::into_inner()` to access the inner receiver, which is safe because the receivers are not self-referential. The `T: Unpin` bound on factory functions ensures the generic type can be moved safely within pinned contexts.

## Usage Pattern
Designed for test scenarios where you need to treat MPSC channels as streams, enabling use with stream combinators and async iteration patterns.
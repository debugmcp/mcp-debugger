# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/mem.rs
@source-hash: bbb9a4de3b4d5998
@generated: 2026-02-09T18:02:51Z

## Purpose
Provides in-memory IO types for async bidirectional and unidirectional communication pipes. Creates buffered channels that implement AsyncRead and AsyncWrite traits for testing and inter-task communication.

## Key Types

### DuplexStream (L49-52)
Bidirectional pipe with separate read/write Arc<Mutex<SimplexStream>> channels. Creates connected socket-like pairs where writes to one end appear as reads on the other end.

Key methods:
- `duplex(max_buf_size)` (L104-118): Factory function creating connected pair
- AsyncRead/AsyncWrite implementations (L120-173): Delegates to underlying SimplexStreams
- Drop implementation (L175-181): Notifies other side of closure

### SimplexStream (L77-95) 
Unidirectional buffered pipe with configurable capacity. Core implementation for both duplex and simplex communication.

Fields:
- `buffer: BytesMut` (L83): Data storage using efficient bytes buffer
- `is_closed: bool` (L85): Write side closure state
- `max_buf_size: usize` (L88): Backpressure threshold
- `read_waker/write_waker: Option<Waker>` (L91-94): Task coordination

Key methods:
- `new_unsplit(max_buf_size)` (L222-230): Creates unified read/write stream
- `simplex(max_buf_size)` (L211-213): Creates split reader/writer pair
- `close_write()/close_read()` (L232-246): Handle closure coordination
- Internal poll methods (L248-324): Core async IO logic with backpressure

## AsyncRead/AsyncWrite Implementations (L327-428)
Both types implement standard traits with conditional cooperative scheduling support:
- Uses cfg_coop! macro for optional cooperative yielding
- Includes tracing integration via trace_leaf()
- SimplexStream supports vectored writes
- Flush is no-op, shutdown triggers write closure

## Architecture Patterns
- Arc<Mutex<>> sharing for DuplexStream thread-safety
- Waker-based task coordination for backpressure
- BytesMut for efficient buffer management with zero-copy potential  
- Conditional compilation for cooperative scheduling features
- Factory functions returning split halves following tokio patterns

## Critical Invariants
- Max buffer size enforcement prevents unbounded memory growth
- Proper waker management prevents task leaks
- Closure propagation ensures both ends are notified
- BrokenPipe errors on writes after closure
- EOF (0 bytes) signals read side closure after buffer drain
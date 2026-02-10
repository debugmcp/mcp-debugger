# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/buf_writer.rs
@source-hash: d453544aad525609
@generated: 2026-02-09T18:02:49Z

## Purpose
Asynchronous buffered writer that improves performance for small, frequent writes by accumulating data in an internal buffer before writing to the underlying AsyncWrite stream.

## Key Components

### BufWriter<W> Struct (L32-38)
Pin-projected buffered writer wrapper containing:
- `inner: W` - underlying AsyncWrite stream 
- `buf: Vec<u8>` - internal buffer for accumulating writes
- `written: usize` - tracks bytes written from buffer to underlying stream
- `seek_state: SeekState` - manages seek operation state

### Constructor Methods (L41-56)
- `new(inner: W)` (L44) - creates writer with default 8KB buffer
- `with_capacity(cap: usize, inner: W)` (L49) - creates writer with custom buffer size

### Core Buffer Management
- `flush_buf()` (L58-84) - internal method that writes buffered data to underlying stream, handles partial writes and errors
- `buffer()` (L113) - returns reference to current buffered data

### Access Methods (L86-115)
- `get_ref()`, `get_mut()`, `get_pin_mut()` - provide access to underlying writer
- `into_inner()` (L108) - consumes wrapper, discarding any buffered data

## AsyncWrite Implementation (L118-211)

### Write Strategy
- `poll_write()` (L119-134): Flushes buffer if new data would exceed capacity, writes large data directly to avoid double-buffering
- `poll_write_vectored()` (L136-196): Optimized vectored writes with two strategies:
  - If underlying supports vectored writes: accumulates small slices, passes large ones directly
  - Otherwise: processes slices sequentially, buffering what fits

### Flush Operations
- `poll_flush()` (L202) - flushes internal buffer then underlying stream
- `poll_shutdown()` (L207) - flushes before shutdown

## Seek Support

### SeekState Enum (L213-221)
State machine for async seeking:
- `Init` - no seek in progress
- `Start(SeekFrom)` - seek requested but not started
- `Pending` - seek operation in progress

### AsyncSeek Implementation (L226-267)
- `start_seek()` (L227) - defers actual seek, just records position
- `poll_complete()` (L235) - flushes buffer before seeking, manages seek state transitions

## Trait Forwarding
- AsyncRead (L269-277) - forwards read operations to underlying stream
- AsyncBufRead (L279-287) - forwards buffered read operations

## Performance Characteristics
- Optimizes small, repeated writes by batching
- No benefit for large single writes or in-memory destinations
- Buffer capacity determines flush frequency vs memory usage
- Direct write bypass for data larger than buffer capacity

## Critical Invariants
- Buffer must be flushed before seeking operations
- Data loss occurs if BufWriter is dropped without explicit flush
- Multiple BufWriters on same stream cause data corruption
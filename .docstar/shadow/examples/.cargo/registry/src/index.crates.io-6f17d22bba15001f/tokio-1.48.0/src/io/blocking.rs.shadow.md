# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/blocking.rs
@source-hash: 9c03c80cc3f3c9fd
@generated: 2026-02-09T18:06:39Z

## Primary Purpose
This module provides asynchronous wrappers around synchronous blocking I/O operations by dispatching them to a blocking thread pool. It bridges sync I/O types (std::io::Read/Write) with Tokio's async I/O traits.

## Key Structures

**Blocking<T> (L14-19)**: Core wrapper that adapts sync I/O types to async. Uses a state machine with internal buffering to handle non-blocking async semantics over blocking operations.
- `inner: Option<T>`: The wrapped sync I/O object (temporarily moved during operations)
- `state: State<T>`: Current operation state (Idle or Busy with pending operation)  
- `need_flush: bool`: Tracks if underlying writer needs flushing

**Buf (L22-25)**: Internal buffer for batching I/O operations
- `buf: Vec<u8>`: Data buffer
- `pos: usize`: Current read position (for partial consumption)

**State<T> (L30-33)**: State machine enum
- `Idle(Option<Buf>)`: Ready for new operations with available buffer
- `Busy(sys::Blocking<...>)`: Operation in progress on thread pool

## Key Operations

**new() (L43-49)**: Unsafe constructor requiring caller to ensure wrapped Read implementation doesn't read from borrowed buffer and reports correct data lengths.

**AsyncRead Implementation (L53-103)**:
- `poll_read()` (L57-102): State machine that either serves from buffer (if data available) or dispatches blocking read to thread pool
- Uses `DEFAULT_MAX_BUF_SIZE` (2MB) to limit buffer allocation per operation
- Handles sys::run() future completion for thread pool operations

**AsyncWrite Implementation (L105-181)**:  
- `poll_write()` (L109-144): Buffers data and dispatches write operations to thread pool
- `poll_flush()` (L146-176): Ensures pending writes are flushed to underlying writer
- `poll_shutdown()` (L178-180): No-op implementation

## Buffer Operations

**Buf methods (L195-278)**:
- `copy_to()` (L211-222): Transfers data from buffer to ReadBuf, managing position tracking
- `copy_from()` (L224-231): Copies data from slice into buffer (requires empty buffer)
- `read_from()` (L241-268): **UNSAFE** - reads directly into uninitialized buffer memory
- `write_to()` (L270-277): Writes entire buffer contents using write_all()

## Utilities

**uninterruptibly! macro (L184-193)**: Retries operations interrupted by signals, essential for robust blocking I/O.

**FS-specific extensions (L281-305)**: Additional buffer operations for filesystem use cases under cfg_fs feature.

## Safety Constraints

The unsafe `new()` and `read_from()` methods require that the wrapped Read implementation never reads from the buffer it borrows and correctly reports written data length. This prevents data races and ensures buffer integrity.

## Architecture Patterns

Uses Option-based state ownership to move resources between async context and blocking thread pool without copying. The state machine ensures proper resource lifecycle management across async suspension points.
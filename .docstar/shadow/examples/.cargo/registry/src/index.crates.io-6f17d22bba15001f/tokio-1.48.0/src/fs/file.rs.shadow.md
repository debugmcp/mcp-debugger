# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/file.rs
@source-hash: 56f11965f8f34b97
@generated: 2026-02-09T18:06:37Z

## Purpose
Tokio's async file wrapper providing non-blocking file I/O operations. Wraps `std::fs::File` with async interfaces for read/write/seek operations using background thread pool.

## Core Structure
- **File** (L90-94): Main async file handle containing Arc<StdFile>, Mutex<Inner>, and max_buf_size
- **Inner** (L96-105): Internal state tracking current operation, write errors, and file position
- **State** (L107-111): Enum managing Idle(buffer) vs Busy(background task) states
- **Operation** (L113-118): Results from background thread operations (Read/Write/Seek)

## Key Methods
### Construction & Conversion
- `open()` (L152): Opens file read-only via OpenOptions
- `create()` (L187): Creates/truncates file for writing
- `create_new()` (L227): Atomic create-new operation preventing TOCTOU races
- `from_std()` (L277): Converts std::fs::File to tokio File
- `into_std()` (L489): Async conversion back to std::fs::File
- `try_into_std()` (L513): Immediate conversion if no operations pending

### File Operations
- `sync_all()` (L312): Flushes all data and metadata to disk
- `sync_data()` (L347): Flushes data only (not metadata)
- `set_len()` (L385): Truncate/extend file to specified size
- `metadata()` (L444): Query file metadata
- `try_clone()` (L464): Create new handle sharing same file descriptor
- `set_permissions()` (L552): Change file permissions

### Buffer Management
- `set_max_buf_size()` (L581): Configure maximum buffer size for I/O operations
- `max_buf_size()` (L586): Get current buffer size limit

## Async Trait Implementations
### AsyncRead (L591-662)
- Uses background thread pool for actual read operations
- Maintains internal buffer for data
- Handles read/write/seek operation completion in state machine

### AsyncWrite (L728-885)  
- `poll_write()` (L729): Single buffer write with background execution
- `poll_write_vectored()` (L800): Vectored write support
- `poll_flush()` (L875): Ensures pending operations complete
- Uses `spawn_mandatory_blocking()` for write operations

### AsyncSeek (L664-726)
- `start_seek()` (L665): Initiates seek operation accounting for buffered data
- `poll_complete()` (L697): Completes pending seek and updates position

## Architecture Patterns
- **Async-over-sync**: Uses thread pool (`spawn_blocking`/`spawn_mandatory_blocking`) for std::fs operations
- **State machine**: Inner manages Idle/Busy states with operation results
- **Buffering**: Uses internal Buf for efficient I/O operations
- **Error handling**: Preserves write errors until next write/flush call
- **Position tracking**: Maintains logical file position across operations

## Platform Support
- Unix: Raw file descriptor access via AsRawFd/AsFd/FromRawFd traits (L902-922)
- Windows: Raw handle access via AsRawHandle/AsHandle/FromRawHandle traits (L924-948)

## Testing Infrastructure
Conditional imports (L20-31) allow mocking of StdFile and blocking operations for testing.

## Critical Invariants
- Operations must complete before file closure to prevent data loss
- Buffer state must be preserved across async operation boundaries  
- Write errors are deferred until next write/flush call
- File position tracking accounts for buffered unread data during seeks
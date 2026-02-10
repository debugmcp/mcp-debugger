# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/uring/write.rs
@source-hash: ed59d648480f3d64
@generated: 2026-02-09T18:02:42Z

## Purpose
Implements asynchronous write operations for Tokio's io_uring backend. Provides a safe wrapper around Linux io_uring write syscalls for file I/O operations.

## Key Components

### Write Struct (L12-15)
Core data structure holding:
- `buf: OwnedBuf` - Buffer containing data to write
- `fd: OwnedFd` - File descriptor for target file

### Trait Implementations

**Completable (L17-22)**
- `Output` type: `(u32, OwnedBuf, OwnedFd)` - returns bytes written, buffer, and file descriptor
- `complete()` method extracts result from completion queue entry and returns owned resources

**Cancellable (L24-28)**
- `cancel()` method wraps Write in `CancelData::Write` for operation cancellation

### Core Operation

**Op::write_at() (L33-53)**
Creates io_uring write operation with:
- `fd`: Target file descriptor
- `buf`: Data buffer to write from
- `buf_offset`: Starting position within buffer
- `file_offset`: File position to write to

**Key Implementation Details:**
- Caps write length to `u32::MAX` due to io_uring limitations (L41)
- Calculates safe write length from buffer bounds (L41-43)
- Creates io_uring write SQE with proper offset (L45-47)
- Uses unsafe `Op::new()` with safety guarantee that parameters remain valid until completion (L49-51)

## Dependencies
- `io_uring` crate for low-level uring operations
- Tokio runtime driver for operation lifecycle management
- `OwnedBuf`/`OwnedFd` for safe resource ownership

## Architectural Notes
- Zero-copy design - transfers ownership rather than copying data
- Memory safety ensured through owned types and lifetime management
- Integrates with Tokio's async runtime through trait implementations
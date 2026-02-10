# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/pipe.rs
@source-hash: 59492aa01fc56c29
@generated: 2026-02-09T18:03:09Z

## Unix pipe types for Tokio async I/O

This module provides async Unix pipe functionality for both anonymous pipes and named pipes (FIFOs).

### Core Types

**`Sender` (L365-791)**: Async writing end of a Unix pipe. Wraps `mio_pipe::Sender` in `PollEvented` for async operations. Supports both anonymous pipes created via `pipe()` and named pipes opened from FIFO files.

**`Receiver` (L861-1366)**: Async reading end of a Unix pipe. Wraps `mio_pipe::Receiver` in `PollEvented` for async operations. Handles EOF conditions and supports resilient reading on Linux with read-write mode.

**`OpenOptions` (L122-286)**: Builder pattern for configuring FIFO file opening. Contains platform-specific `read_write` field (Linux/Android only) and `unchecked` flag to skip FIFO validation.

### Key Functions

**`pipe()` (L67-70)**: Creates anonymous pipe pair using `mio_pipe::new()`, returning `(Sender, Receiver)` tuple. Requires Tokio runtime with IO enabled.

**Construction methods**:
- `Sender::from_file()` (L394) / `Receiver::from_file()` (L890): Create from `File` with validation
- `Sender::from_owned_fd()` (L419) / `Receiver::from_owned_fd()` (L915): Create from `OwnedFd` with validation  
- `*_unchecked()` variants (L474, L970): Skip pipe/access mode validation

**OpenOptions methods**:
- `open_sender()`/`open_receiver()` (L255, L229): Open FIFO file as pipe end
- `read_write()` (L173): Linux-only read-write mode for resilient pipes
- `unchecked()` (L205): Skip FIFO type validation

### Async Operations

**Sender async methods**:
- `ready()` (L519): Wait for interest-based readiness events
- `writable()` (L564): Wait for write readiness
- `try_write()`/`try_write_vectored()` (L653, L719): Non-blocking write attempts
- `poll_write_ready()` (L596): Poll-based readiness checking

**Receiver async methods**:
- `readable()` (L1064): Wait for read readiness  
- `try_read()`/`try_read_vectored()` (L1160, L1234): Non-blocking read attempts
- `try_read_buf()` (L1297): Read into `BufMut` (conditionally compiled)

### File Descriptor Utilities

**Validation functions**:
- `is_pipe()` (L1368): Check if fd is pipe/FIFO using `fstat()`
- `has_read_access()`/`has_write_access()` (L1396, L1402): Check O_RDONLY/O_WRONLY/O_RDWR modes
- `get_file_flags()` (L1385): Get fd flags via `fcntl(F_GETFL)`

**Mode setting**:
- `set_nonblocking()` (L1408): Add O_NONBLOCK flag
- `set_blocking()` (L1424): Remove O_NONBLOCK flag

### Platform-Specific Features

Linux/Android read-write mode allows opening FIFOs without blocking for opposite end, preventing ENXIO errors and enabling resilient reading patterns.

### Conversion Methods

Both `Sender` and `Receiver` provide `into_blocking_fd()`/`into_nonblocking_fd()` methods to convert back to raw file descriptors while properly handling event loop deregistration.

### Trait Implementations

- `Sender`: `AsyncWrite`, `AsRawFd`, `AsFd`
- `Receiver`: `AsyncRead`, `AsRawFd`, `AsFd`
- Both handle vectored I/O and provide standard async stream interfaces

### Critical Invariants

- All pipe operations require active Tokio runtime with IO enabled
- File descriptors must be set to non-blocking mode for async operation
- Read-write mode on non-Linux platforms is undefined behavior
- Proper cleanup via `into_*_fd()` methods prevents fd leaks
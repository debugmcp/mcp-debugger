# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/stream.rs
@source-hash: 791916ef57fc6056
@generated: 2026-02-09T18:03:08Z

## Primary Purpose

Implements `UnixStream` - an asynchronous Unix domain socket stream for bidirectional communication between processes on Unix systems. Wraps `mio::net::UnixStream` with Tokio's async I/O infrastructure.

## Key Components

### Core Structure
- **UnixStream (L43-45)**: Main struct containing a `PollEvented<mio::net::UnixStream>` for async operations

### Connection Methods
- **connect() (L72-99)**: Async connection to socket path, handles Linux abstract socket paths (starting with `\0`)
- **connect_mio() (L49-65)**: Internal helper for MIO stream connection with write-readiness polling
- **pair() (L885-891)**: Creates connected socket pair for IPC

### I/O Operations
- **try_read() (L336-340)**: Non-blocking read with `Interest::READABLE`
- **try_read_vectored() (L414-418)**: Vectored read operation
- **try_read_buf() (L480-498)**: Read into `BufMut` (conditional compilation)
- **try_write() (L637-641)**: Non-blocking write with `Interest::WRITABLE` 
- **try_write_vectored() (L699-703)**: Vectored write operation

### Readiness Management
- **ready() (L176-179)**: Await specified interest states (read/write/both)
- **readable() (L233-236)**: Convenience wrapper for read readiness
- **writable() (L549-552)**: Convenience wrapper for write readiness
- **poll_read_ready() (L267-269)**: Manual polling for read readiness
- **poll_write_ready() (L583-585)**: Manual polling for write readiness

### Advanced I/O
- **try_io() (L737-745)**: User-provided I/O operations with readiness management
- **async_io() (L772-781)**: Async version of custom I/O operations

### Conversions & Utilities
- **from_std() (L825-832)**: Convert from `std::os::unix::net::UnixStream`
- **into_std() (L873-878)**: Convert to standard library stream
- **new() (L893-896)**: Internal constructor from MIO stream
- **local_addr()/peer_addr() (L914-916, L934-936)**: Socket addresses
- **peer_cred() (L939-941)**: Process credentials via UCred
- **take_error() (L944-946)**: Retrieve SO_ERROR value

### Stream Splitting
- **split() (L967-969)**: Borrowed split into read/write halves
- **into_split() (L982-984)**: Owned split (heap allocated)

### Trait Implementations
- **AsyncRead (L999-1007)**: Delegates to `poll_read_priv()`
- **AsyncWrite (L1009-1038)**: Full async write implementation with vectored support
- **TryFrom<net::UnixStream> (L987-997)**: Conversion trait
- **Debug, AsRef, AsRawFd, AsFd (L1073-1095)**: Standard trait implementations

## Architecture Patterns

- **Event-driven I/O**: Uses `PollEvented` wrapper for MIO integration
- **Readiness-based operations**: All I/O paired with readiness checking to avoid blocking
- **Platform-specific handling**: Conditional compilation for Linux/Android abstract sockets
- **Zero-copy vectored I/O**: Supports scatter-gather operations
- **Graceful degradation**: Non-blocking operations return `WouldBlock` when not ready

## Critical Invariants

- Stream must be in non-blocking mode for proper async operation
- Readiness flags cleared on `WouldBlock` errors to maintain correct state
- Custom I/O operations must only return `WouldBlock` for actual socket readiness issues
- Write half shutdown on owned split drop
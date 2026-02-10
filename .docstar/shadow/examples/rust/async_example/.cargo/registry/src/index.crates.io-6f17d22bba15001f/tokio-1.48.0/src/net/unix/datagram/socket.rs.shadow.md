# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/datagram/socket.rs
@source-hash: c5a5ed89c3a16a07
@generated: 2026-02-09T17:58:25Z

## Primary Purpose

Implements `UnixDatagram` - Tokio's async wrapper for Unix domain datagram sockets, providing non-blocking I/O operations for connectionless IPC on Unix systems.

## Core Structure

- **UnixDatagram** (L96-98): Main struct containing `PollEvented<mio::net::UnixDatagram>` for async I/O management

## Key Creation Methods

- **bind()** (L395-401): Creates socket bound to filesystem path
- **pair()** (L433-439): Creates unnamed connected socket pair
- **unbound()** (L564-567): Creates unbound socket for client use
- **from_std()** (L491-497): Converts std::UnixDatagram to Tokio version
- **from_mio()** (L102-110): Internal constructor from mio socket

## Readiness and Polling

- **ready()** (L182-185): Waits for specified readiness states
- **readable()** (L335-338): Waits for read readiness
- **writable()** (L239-242): Waits for write readiness
- **poll_recv_ready()** (L369-371): Polls for read readiness
- **poll_send_ready()** (L273-275): Polls for write readiness

## Send Operations

- **send()** (L644-649): Async send to connected peer
- **send_to()** (L1101-1109): Async send to specified address
- **try_send()** (L689-693): Non-blocking send to connected peer
- **try_send_to()** (L732-739): Non-blocking send to address
- **poll_send()** (L1256-1260): Poll-based send to connected peer
- **poll_send_to()** (L1219-1231): Poll-based send to address

## Receive Operations

- **recv()** (L775-780): Async receive from connected peer
- **recv_from()** (L1152-1160): Async receive with sender address
- **try_recv()** (L826-830): Non-blocking receive from connected peer
- **try_recv_from()** (L1347-1354): Non-blocking receive with sender address
- **poll_recv()** (L1285-1302): Poll-based receive from connected peer
- **poll_recv_from()** (L1179-1200): Poll-based receive with sender address

## Buffer-aware Operations (cfg_io_util!)

- **recv_buf()** (L1043-1058): Async receive with BufMut advancement
- **recv_buf_from()** (L933-948): Async receive from address with BufMut
- **try_recv_buf()** (L995-1011): Non-blocking receive with BufMut
- **try_recv_buf_from()** (L876-894): Non-blocking receive from address with BufMut

## Connection and Address Management

- **connect()** (L607-609): Connect to remote address
- **local_addr()** (L1476-1478): Get local socket address
- **peer_addr()** (L1527-1529): Get connected peer address

## Advanced I/O Operations

- **try_io()** (L1388-1396): Custom I/O operation with interest
- **async_io()** (L1423-1432): Async custom I/O operation

## Utility Methods

- **into_std()** (L520-525): Convert to std::UnixDatagram
- **take_error()** (L1551-1553): Get SO_ERROR value
- **shutdown()** (L1588-1590): Shutdown socket halves

## Key Dependencies

- `mio::net::UnixDatagram`: Underlying non-blocking socket implementation
- `PollEvented`: Tokio's async I/O wrapper providing readiness notifications
- `Interest`, `Ready`: Readiness state management types
- `SocketAddr`: Unix socket address wrapper

## Architecture Notes

- All methods take `&self` (not `&mut self`) enabling Arc-based sharing without Mutex
- Uses registration-based async I/O with `try_io`/`async_io` patterns
- Supports both named (filesystem) and unnamed (paired) sockets
- Implements cancel-safe async operations
- Buffer operations use unsafe pointer casting for uninitialized memory handling

## Important Constraints

- Named sockets persist in filesystem after program exit
- Non-blocking mode required for std conversion compatibility
- False-positive readiness events possible, requiring `WouldBlock` handling
- Combined interests not supported in custom I/O operations
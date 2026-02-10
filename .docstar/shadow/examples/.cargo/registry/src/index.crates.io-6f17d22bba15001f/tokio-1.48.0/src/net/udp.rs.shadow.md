# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/udp.rs
@source-hash: 3a28e27f463631de
@generated: 2026-02-09T18:06:53Z

## Tokio UdpSocket Implementation

This file provides an async UDP socket implementation for the Tokio runtime, wrapping `mio::net::UdpSocket` with async I/O capabilities.

### Core Structure

**UdpSocket** (L122-124): Main async UDP socket wrapper containing a `PollEvented<mio::net::UdpSocket>` for non-blocking I/O operations.

### Key Construction Methods

- **bind()** (L150-167): Async factory method that resolves addresses and binds to first available
- **bind_addr()** (L169-172): Synchronous helper for binding to specific SocketAddr  
- **new()** (L175-178): Internal constructor wrapping mio socket in PollEvented
- **from_std()** (L227-232): Converts std::net::UdpSocket to tokio UdpSocket with blocking check
- **into_std()** (L256-274): Converts back to std socket using platform-specific raw fd/socket APIs

### Connection Management

- **connect()** (L348-365): Associates socket with remote address for connected UDP operations
- **local_addr()** (L297-299): Returns bound local address
- **peer_addr()** (L320-322): Returns connected remote address

### Async I/O Operations

**Send Operations:**
- **send()** (L565-570): Async send to connected peer using `async_io` pattern
- **send_to()** (L1174-1184): Async send to arbitrary address, resolves first address from ToSocketAddrs
- **send_to_addr()** (L1267-1272): Internal helper for sending to specific SocketAddr

**Receive Operations:**
- **recv()** (L785-790): Async receive from connected peer
- **recv_from()** (L1315-1320): Async receive with sender address
- **recv_buf()**/**recv_buf_from()** (L988-1135): Buffer-advancing variants using BufMut trait

**Peek Operations:**
- **peek()** (L1556-1561): Peek at data without removing from queue
- **peek_from()** (L1698-1703): Peek with sender address
- **peek_sender()** (L1815-1820): Get sender address without data

### Non-blocking Variants

All async operations have corresponding non-blocking `try_*` variants (e.g., `try_send` L649-653, `try_recv` L884-888) that return `WouldBlock` errors immediately when socket isn't ready.

### Readiness and Polling

- **ready()** (L435-438): Wait for specific Interest flags (READABLE/WRITABLE)
- **readable()**/**writable()** (L710-713, L490-493): Convenience methods for readiness
- **poll_*()** methods provide lower-level polling interface for manual async implementations

### Socket Configuration

**Broadcast/Multicast:**
- **broadcast()**/**set_broadcast()** (L884-894): SO_BROADCAST option
- **multicast_*_v4/v6()** methods (L901-956): Multicast loop and TTL settings  
- **join/leave_multicast_v4/v6()** (L2097-2126): Multicast group membership

**Quality of Service:**
- **ttl()**/**set_ttl()** (L977-2001): IP_TTL option
- **tos()**/**set_tos()** (L2029-2060): IP_TOS option (platform-conditional)

**Platform-Specific:**
- **device()**/**bind_device()** (L2070-2088): SO_BINDTODEVICE on Linux/Android
- **take_error()** (L2148-2150): SO_ERROR retrieval

### Architecture Patterns

Uses consistent async I/O pattern through `PollEvented` registration:
- `async_io(Interest, closure)` for async operations
- `try_io(Interest, closure)` for non-blocking attempts  
- `poll_*_io(cx, closure)` for manual polling

### Platform Integration

Implements standard traits for file descriptor/socket handle access:
- Unix: `AsRawFd`, `AsFd` (L2176-2186)
- Windows: `AsRawSocket`, `AsSocket` (L2193-2204)

### Safety Considerations

Contains unsafe code for:
- Buffer management with uninitialized memory (L819-821, L819-821, etc.)
- Platform-specific socket conversion (L258-273)
- Raw fd/socket borrowing (L2184, L2201)

All unsafe operations are documented and follow standard patterns for async I/O buffer management.
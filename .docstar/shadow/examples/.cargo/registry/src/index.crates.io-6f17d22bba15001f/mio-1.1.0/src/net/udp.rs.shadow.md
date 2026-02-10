# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/udp.rs
@source-hash: 3c852aa4eadc6bd3
@generated: 2026-02-09T18:06:36Z

# UDP Socket Module

**Purpose**: Non-blocking UDP socket implementation for the Mio async I/O library, providing cross-platform UDP networking primitives with edge-triggered event polling capabilities.

## Core Type

**UdpSocket (L95-97)**: Main UDP socket wrapper around `IoSource<net::UdpSocket>` providing async-ready UDP operations.

## Key Methods

### Construction & Conversion
- `bind(addr: SocketAddr)` (L125-127): Creates UDP socket bound to address via `sys::udp::bind`
- `from_std(socket: net::UdpSocket)` (L135-139): Wraps std library UDP socket in Mio equivalent
- Bidirectional conversion to/from `net::UdpSocket` (L757-772)

### Address Information
- `local_addr()` (L164-166): Returns bound socket address
- `peer_addr()` (L187-189): Returns connected peer address
- `connect(addr: SocketAddr)` (L331-333): Sets default destination for send/recv operations

### Data Transfer
- `send_to(buf, target)` (L215-217): Send to specific address
- `recv_from(buf)` (L250-252): Receive with source address
- `peek_from(buf)` (L286-288): Peek without removing data
- `send(buf)` (L292-294): Send to connected peer
- `recv(buf)` (L306-308): Receive from connected peer
- `peek(buf)` (L320-322): Peek from connected peer

### Socket Configuration
- Broadcast: `set_broadcast()`/`broadcast()` (L359-387)
- TTL: `set_ttl()`/`ttl()` (L470-499)
- IPv4 multicast: `set_multicast_loop_v4()`/`multicast_loop_v4()`, `set_multicast_ttl_v4()`/`multicast_ttl_v4()` (L393-426)
- IPv6 multicast: `set_multicast_loop_v6()`/`multicast_loop_v6()` (L432-444)
- Multicast membership: `join_multicast_v4/v6()`, `leave_multicast_v4/v6()` (L509-543)
- IPv6-only: `only_v6()` (L547-549)

### Error Handling & Low-level Access
- `take_error()` (L556-558): Retrieve and clear socket error state
- `try_io(f)` (L611-616): Execute custom I/O operations with proper event handling

## Event System Integration

**Source Implementation (L619-641)**: Implements Mio's `event::Source` trait for event loop registration:
- `register()` (L620-627): Register with event registry
- `reregister()` (L629-636): Update registration
- `deregister()` (L638-640): Remove from registry

## Platform-Specific Traits

### Unix/WASI/Hermit (L649-701)
- Raw file descriptor traits: `IntoRawFd`, `AsRawFd`, `FromRawFd` 
- Owned file descriptor conversions: `From<OwnedFd>`, `AsFd`

### Windows (L703-755)
- Raw socket traits: `IntoRawSocket`, `AsRawSocket`, `FromRawSocket`
- Owned socket conversions: `From<OwnedSocket>`, `AsSocket`

## Dependencies

- `IoSource` from `crate::io_source`: Core I/O wrapper providing event integration
- `sys::udp`: Platform-specific UDP implementation 
- `event`, `Registry`, `Token`, `Interest`: Mio event system types
- Platform-specific socket/fd traits from std

## Key Patterns

- **IoSource Delegation**: Most operations delegate to `self.inner.do_io()` for proper event handling
- **Platform Abstraction**: Conditional compilation provides unified API across Unix/Windows
- **Non-blocking Guarantees**: All I/O operations return `WouldBlock` when not ready
- **Event-driven**: Requires registration with Mio's `Poll` for notifications

## Critical Notes

- Windows buffer overflow behavior: recv operations truncate oversized packets and return `WSAEMSGSIZE` (L224-228, L260-264, L301-305, L315-319)
- Maximum UDP packet size: 65536 bytes
- Non-blocking mode responsibility: Caller must ensure socket is non-blocking when converting from raw handles
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/socket2-0.6.1/src/socket.rs
@source-hash: 35f0941917587a7e
@generated: 2026-02-09T18:12:00Z

**Primary Purpose**: Core socket wrapper providing low-level cross-platform socket operations with Rust safety guarantees. Acts as the main interface for the socket2 crate, wrapping system socket handles and providing comprehensive socket configuration and I/O operations.

**Core Structure**:
- `Socket` struct (L75-77): Wrapper around platform-specific `sys::Socket`, providing owned socket handle management
- Raw socket creation/conversion methods (L86-127): `from_raw()`, `new()`, `new_raw()` for socket instantiation
- Socket pair creation (L136-161): Unix-only `pair()` and `pair_raw()` for connected socket pairs

**Network Operations**:
- Connection management (L168-242): `bind()`, `connect()`, `connect_timeout()`, `listen()`
- Accept operations (L259-303): `accept()` with common flags set, `accept_raw()` without flags
- Address resolution (L317-334): `local_addr()`, `peer_addr()` for endpoint information
- Socket introspection (L338-340): `r#type()` to get socket type

**I/O Operations**:
- Receive methods (L414-633): `recv()`, `recv_vectored()`, `recv_from()` with various flag variants
- Send methods (L642-735): `send()`, `send_vectored()`, `send_to()` with flag support
- Advanced I/O (L631-633, L733-735): `recvmsg()`, `sendmsg()` for Unix message-based I/O
- Standard trait implementations (L2245-2307): `Read` and `Write` traits for stdlib compatibility

**Socket Configuration** (grouped by protocol level):

*SOL_SOCKET options (L825-1131)*:
- Basic options: `broadcast()`, `keepalive()`, `linger()`, buffer sizes
- Timeout configuration: `read_timeout()`, `write_timeout()` 
- Address reuse: `reuse_address()`
- Error handling: `take_error()`

*IPv4 options (L1159-1671)*:
- Header control: `header_included_v4()`, `ip_transparent_v4()`
- Multicast: `join_multicast_v4()`, `leave_multicast_v4()`, `join_ssm_v4()`
- Routing: `multicast_if_v4()`, `multicast_loop_v4()`, `multicast_ttl_v4()`
- QoS: `ttl_v4()`, `tos_v4()`, `recv_tos_v4()`

*IPv6 options (L1678-2085)*:
- Multicast: `join_multicast_v6()`, `leave_multicast_v6()`
- Routing: `multicast_if_v6()`, `multicast_hops_v6()`, `unicast_hops_v6()`
- Protocol control: `only_v6()`, traffic class and hop limit reception

*TCP options (L2092-2243)*:
- Keepalive configuration: `set_tcp_keepalive()` with `TcpKeepalive` struct
- Nagle algorithm: `tcp_nodelay()`

**Utility Functions**:
- Common flag setters (L741-799): `set_common_type()`, `set_common_flags()` for cross-platform socket initialization
- Linger helpers (L1133-1152): `from_linger()`, `into_linger()` for timeout conversion
- Interface addressing (L813-818): `InterfaceIndexOrAddress` enum for network interface specification

**Platform Abstractions**:
- Conditional compilation throughout for OS-specific features
- Raw socket handle management with platform-appropriate types
- Common socket operations unified across Unix/Windows

**Key Architectural Decisions**:
- Two-tier socket creation: `new()` sets common flags, `new_raw()` for bare sockets
- Extensive use of `unsafe` blocks for system call wrappers with safety documentation
- MaybeUninit buffers for uninitialized memory safety in I/O operations
- Feature gating (`feature = "all"`) for advanced functionality
- Non-atomic socket option updates noted as potential race condition source (L50-54)

**Dependencies**: 
- `crate::sys` for platform-specific implementations
- Standard library networking types with `From` trait implementations (L2319-2324)
- Various imported types: `Domain`, `Protocol`, `SockAddr`, `TcpKeepalive`
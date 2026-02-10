# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/socket2-0.6.1/src/lib.rs
@source-hash: a0129ce47cc29b19
@generated: 2026-02-09T18:11:59Z

## Purpose
Low-level socket creation and manipulation library providing direct access to system socket APIs without unsafe code. Main entry point module for socket2 crate that provides cross-platform socket utilities with advanced configuration options.

## Core Types

### Domain (L213-245)
Newtype wrapper around `c_int` specifying socket communication domain:
- `Domain::IPV4` - AF_INET for IPv4 (L218)
- `Domain::IPV6` - AF_INET6 for IPv6 (L221)  
- `Domain::UNIX` - AF_UNIX for Unix sockets (L224)
- `Domain::for_address()` - Returns appropriate domain for given SocketAddr (L227-232)

### Type (L256-295)
Newtype wrapper around `c_int` specifying socket communication semantics:
- `Type::STREAM` - SOCK_STREAM for TCP-like protocols (L263)
- `Type::DGRAM` - SOCK_DGRAM for UDP-like protocols (L268)
- `Type::DCCP` - Linux DCCP support (L274, feature-gated)
- `Type::SEQPACKET` - Sequential packet sockets (L278, feature-gated)
- `Type::RAW` - Raw sockets (L282, feature-gated)

### Protocol (L304-359)
Newtype wrapper around `c_int` for socket protocol specification:
- Common protocols: ICMPV4, ICMPV6, TCP, UDP (L309-318)
- Platform-specific: MPTCP (Linux), DCCP, SCTP, UDPLITE, DIVERT (L321-347)

### TcpKeepalive (L423-558)
Configuration struct for TCP keepalive parameters:
- `with_time()` - Sets idle time before probes (L492-497)
- `with_interval()` - Sets probe interval (L522-527, platform-conditional)
- `with_retries()` - Sets max probe count (L552-557, feature-gated)

### MaybeUninitSlice (L387-418)
Transparent wrapper around system-specific MaybeUninitSlice for uninitialized buffer handling:
- `new()` - Creates from MaybeUninit byte slice (L401-403)
- Implements Deref/DerefMut for slice access (L406-418)

### RecvFlags (L366-381)
Flags for incoming message information:
- `is_truncated()` - Checks MSG_TRUNC for datagram truncation (L378-380)

### Message Headers (L565-703)
**MsgHdr** (L565-626): Configuration for `sendmsg(2)` system calls
- `new()` - Creates zeroed message header (L575-581)
- `with_addr()` - Sets destination address (L587-590)
- `with_buffers()` - Sets IoSlice buffers (L596-600)
- `with_control()` - Sets control buffer (L606-610)
- `with_flags()` - Sets message flags (L615-618)

**MsgHdrMut** (L633-703): Configuration for `recvmsg(2)` system calls
- Similar builder pattern but with mutable references
- `flags()` - Returns received message flags (L684-686)
- `control_len()` - Gets actual control buffer length (L693-695)

## Key Macros

### impl_debug (L80-105)
Generates Debug implementations that print constant names instead of numeric values for socket constants.

### from (L108-123)
Cross-platform conversion macro between network types using raw file descriptors (Unix) or raw sockets (Windows).

### man_links (L126-173)
Documentation macro generating links to system manual pages for multiple operating systems.

## Module Structure
- `sockaddr` - Socket address handling (L175)
- `socket` - Main Socket implementation (L176)
- `sockref` - Socket reference types (L177)
- `sys` - Platform-specific implementations (L179-181)

## Platform Support
Supports Unix and Windows platforms via conditional compilation. Includes compile-time error for unsupported targets (L183-184).

## Public Exports
Key re-exports include Socket, SockAddr, SockRef, and platform-specific types like InterfaceIndexOrAddress and Linux-specific networking filters (L188-202).

## Design Patterns
- Newtype wrappers around C integers with const constructors
- Builder pattern for complex configuration structs
- Zero-copy buffer handling with MaybeUninit
- Platform-conditional compilation throughout
- Direct system call mapping philosophy
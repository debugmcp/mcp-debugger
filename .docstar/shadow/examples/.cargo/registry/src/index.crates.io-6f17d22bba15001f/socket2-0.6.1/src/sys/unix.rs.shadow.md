# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/socket2-0.6.1/src/sys/unix.rs
@source-hash: 628ffdf70b52ced6
@generated: 2026-02-09T18:06:47Z

## Unix-specific Socket Implementation

This module provides the Unix-specific implementation of socket operations for the socket2 crate, containing platform-specific functionality for Unix-like operating systems.

### Core Types and Constants

**Type Aliases (L862-863):**
- `Socket = std::os::fd::OwnedFd` - Unix socket represented as an owned file descriptor
- `RawSocket = c_int` - Raw socket file descriptor type  
- `Bool = c_int` - Boolean type for socket options (L275)

**Buffer Length Constants (L321-339):**
- `MAX_BUF_LEN` - Platform-specific maximum buffer size for recv/send operations
- Uses `ssize_t::MAX` on most platforms, `c_int::MAX - 1` on macOS/iOS to work around libc issues

### System Call Interface

**Syscall Macro (L300-310):**
Core macro for executing libc system calls with automatic error handling, converting -1 returns to `io::Error::last_os_error()`

**Socket Operations:**
- `socket()` (L877) - Create new socket
- `bind()` (L887) - Bind socket to address  
- `connect()` (L891) - Connect to remote address
- `listen()` (L937) - Listen for connections
- `accept()` (L941) - Accept incoming connection
- `poll_connect()` (L895) - Non-blocking connection with timeout using poll()

### Address Handling

**Unix Socket Addresses (L650-692):**
- `unix_sockaddr()` - Convert Path to Unix socket address
- `offset_of_path()` (L643) - Calculate offset of sun_path in sockaddr_un
- Handles both pathname and abstract namespace addresses

**Address Methods in SockAddr:**
- `as_unix()` (L824) - Convert to std Unix SocketAddr
- `as_pathname()` (L833) - Extract pathname from Unix address
- `as_abstract_namespace()` (L847) - Extract abstract namespace (Linux-specific)
- `is_unnamed()` (L769) - Check for unnamed Unix sockets
- `as_vsock_address()` (L757) - Extract VSOCK CID/port (Linux-specific)

### Platform-Specific Extensions

**Domain Extensions (L389-400):**
- `Domain::PACKET` - AF_PACKET for low-level packet interface (Linux/Android)
- `Domain::VSOCK` - AF_VSOCK for VM communication (Linux/Android)

**Type Extensions:**
- `Type::nonblocking()` (L431) - Add SOCK_NONBLOCK flag
- `Type::cloexec()` (L453) - Add SOCK_CLOEXEC flag

**RecvFlags Extensions (L540-590):**
- `is_end_of_record()` (L551) - Check MSG_EOR flag
- `is_out_of_band()` (L561) - Check MSG_OOB flag  
- `is_confirm()` (L573) - Check MSG_CONFIRM flag (Linux)
- `is_dontroute()` (L587) - Check MSG_DONTROUTE flag

### Socket Option Implementations

**TCP Options:**
- `tcp_mss()` / `set_tcp_mss()` (L567, L579) - TCP_MAXSEG option
- `tcp_cork()` / `set_tcp_cork()` (L1695, L1712) - TCP_CORK option (Linux)
- `tcp_quickack()` / `set_tcp_quickack()` (L1737, L1759) - TCP_QUICKACK option
- `tcp_congestion()` / `set_tcp_congestion()` (L2597, L2617) - TCP congestion control algorithm

**Linux-Specific Options:**
- `mark()` / `set_mark()` (L1657, L1675) - SO_MARK for packet marking
- `device()` / `bind_device()` (L1846, L1878) - SO_BINDTODEVICE interface binding
- `cpu_affinity()` / `set_cpu_affinity()` (L2098, L2109) - SO_INCOMING_CPU

**BSD-Style Options:**
- `reuse_port()` / `set_reuse_port()` (L2129, L2145) - SO_REUSEPORT
- `set_nosigpipe()` (L1539) - SO_NOSIGPIPE (macOS/iOS)

### Advanced Features

**Berkeley Packet Filter (L2491-2523):**
- `SockFilter` struct (L2877) - BPF filter representation
- `attach_filter()` / `detach_filter()` - SO_ATTACH_FILTER/SO_DETACH_FILTER

**DCCP Support (Linux, L2639-2844):**
- Service codes, CCID configuration, checksum coverage
- Complete DCCP socket option interface

**File Transfer:**
- `sendfile()` (L2313) - Zero-copy file transfer with platform-specific implementations for macOS, Linux, FreeBSD, AIX

### Message Handling

**Vectored I/O (L1046-1138):**
- `recv_vectored()` / `send_vectored()` - Scatter-gather I/O operations
- `recvmsg()` / `sendmsg()` - Full message header control
- `MaybeUninitSlice` (L613) - Safe uninitialized buffer wrapper

**Message Headers:**
- `msghdr` manipulation functions (L699-730)
- Support for control messages and ancillary data

### IP Conversion Utilities

**IPv4/IPv6 Conversion (L1320-1341):**
- `to_in_addr()` / `from_in_addr()` - Convert between Rust and libc IPv4 types
- `to_in6_addr()` / `from_in6_addr()` - Convert between Rust and libc IPv6 types
- `to_mreqn()` (L1356) - Create multicast request structures

### File Descriptor Integration

**Standard Library Integration (L2920-2957):**
Full integration with std::os::fd traits (AsFd, AsRawFd, IntoRawFd, FromRawFd) and Unix socket types (UnixStream, UnixListener, UnixDatagram)

The module uses extensive conditional compilation to handle differences across Unix platforms, with special handling for Linux, macOS, FreeBSD, Android, and other Unix variants.
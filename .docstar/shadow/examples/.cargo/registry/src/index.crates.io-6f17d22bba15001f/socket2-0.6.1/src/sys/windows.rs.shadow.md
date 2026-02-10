# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/socket2-0.6.1/src/sys/windows.rs
@source-hash: 3fad84a530150ef4
@generated: 2026-02-09T18:06:46Z

## Purpose
Windows-specific socket implementation layer for socket2 crate. Provides Windows Sockets (WinSock2) API bindings and platform-specific socket operations through native Windows system calls.

## Architecture
- **Platform abstraction**: Implements cross-platform socket interface using Windows-specific APIs
- **System call wrapper**: `syscall!` macro (L103-113) standardizes WinSock error handling
- **Type aliases**: Maps Windows types to cross-platform socket types (L245-246)
- **Initialization**: Lazy WinSock initialization via `init()` (L234-243)

## Key Types & Constants

### Core Type Mappings
- `Socket` = `std::os::windows::io::OwnedSocket` (L245)  
- `RawSocket` = `windows_sys::Win32::Networking::WinSock::SOCKET` (L246)
- `Bool` = `bool` (L97) - Windows socket option type quirk

### Address Family Constants (L48-51)
- `AF_INET`, `AF_INET6`, `AF_UNIX`, `AF_UNSPEC` - Domain constants

### Socket Type Constants (L53-58)  
- `SOCK_STREAM`, `SOCK_DGRAM`, `SOCK_RAW`, `SOCK_SEQPACKET` - Type constants

### Custom Flags (L125-129)
- `Type::NO_INHERIT` - Windows WSA_FLAG_NO_HANDLE_INHERIT equivalent
- `Type::REGISTERED_IO` - Windows WSA_FLAG_REGISTERED_IO support

## Core Socket Operations

### Socket Creation & Management
- `socket()` (L260-289): Creates socket with Windows-specific flags handling
- `try_clone()` (L417-440): Socket duplication via WSADuplicateSocketW
- `set_no_inherit()` (L1000-1016): Handle inheritance control

### Network Operations
- `bind()`, `connect()`, `listen()`, `accept()` (L291-387): Standard socket operations
- `poll_connect()` (L309-356): Timeout-based connection polling using WSAPoll
- `shutdown()` (L447-454): Connection shutdown

### Data Transfer
- `recv/send` family (L456-724): Single/vectored I/O operations
- `recv_from/send_to` (L508-703): Datagram operations with addressing
- `sendmsg()` (L705-724): Message-based sending

### Socket Options
- `getsockopt/setsockopt()` (L803-844): Generic option handling
- `set_tcp_keepalive()` (L765-799): TCP keepalive configuration
- `timeout_opt/set_timeout_opt()` (L727-763): Platform-specific timeout handling

## Windows-Specific Features

### MaybeUninitSlice Wrapper (L174-202)
Adapts Rust's `MaybeUninit<u8>` buffers to Windows `WSABUF` structure for vectored I/O.

### Message Header Support (L207-232)
Functions for manipulating Windows `WSAMSG` structures for advanced socket messaging.

### Address Conversion (L855-906) 
- IPv4/IPv6 address conversion between Rust and Windows native formats
- Multicast request structure creation

### Unix Domain Socket Support (L948-990)
UTF-8 path handling for Windows AF_UNIX sockets with length validation.

## Error Handling Patterns
- `WSAESHUTDOWN` → `Ok(0)` for graceful shutdown detection
- `WSAEMSGSIZE` → `MSG_TRUNC` flag for truncated messages  
- Timeout operations clamp to `INFINITE` for Windows compatibility

## Dependencies
- `windows_sys::Win32::Networking::WinSock` - Primary WinSock2 bindings
- `windows_sys::Win32::Foundation` - Handle management
- Standard library Windows I/O traits integration

## Architectural Constraints
- Buffer length limited to `c_int::MAX` (L100)
- Custom bit flags use high-order bits to avoid conflicts
- UTF-8 path requirement for Unix sockets on Windows
- UB warning in vectored send operations due to Windows API ownership semantics (L632-644)
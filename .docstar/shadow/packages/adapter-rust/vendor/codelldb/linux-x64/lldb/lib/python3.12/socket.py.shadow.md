# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/socket.py
@source-hash: b1d5ea1854877f0c
@generated: 2026-02-09T18:10:05Z

## Purpose
Python socket module wrapper that provides high-level socket operations with additional Python-implemented facilities. Enhances the low-level `_socket` module with convenience functions, improved error handling, file-like interfaces, and cross-platform compatibility.

## Key Components

### Main Socket Class
- **socket (L215-541)**: Enhanced wrapper around `_socket.socket`
  - Adds context manager support (`__enter__`/`__exit__` L237-242)
  - Implements `makefile()` for file-like I/O interface (L304-346)
  - Provides `sendfile()` with fallback mechanisms (L468-489)
  - Manages I/O reference counting for proper cleanup (L491-505)
  - Property accessors convert numeric values to IntEnum types (L517-527)
  - Platform-specific inheritable flag management (L529-541)

### I/O Stream Implementation
- **SocketIO (L677-792)**: Raw I/O implementation for socket streams
  - Inherits from `io.RawIOBase` for standard I/O interface
  - Handles socket-specific timeouts and non-blocking behavior
  - Implements `readinto()`, `write()`, `readable()`, `writable()` methods
  - Manages socket reference counting on close

### Utility Functions
- **fromfd (L542-549)**: Creates socket from file descriptor
- **getfqdn (L794-818)**: Resolves fully qualified domain names
- **create_connection (L823-872)**: High-level connection establishment with timeout/retry
- **create_server (L890-956)**: Server socket creation with configuration options
- **has_dualstack_ipv6 (L874-887)**: IPv4/IPv6 dual-stack capability detection

### Enum Conversions
- **AddressFamily, SocketKind, MsgFlag, AddressInfo (L76-94)**: IntEnum/IntFlag conversions for socket constants
- **_intenum_converter (L100-108)**: Helper for numeric-to-enum conversion

### Platform-Specific Features
- **WSA Error Table (L112-209)**: Windows socket error code mappings
- **File Descriptor Passing (L551-583)**: Unix domain socket FD transmission (`send_fds`/`recv_fds`)
- **Socket Sharing (L585-593)**: Windows socket handle sharing (`fromshare`)
- **Socketpair Implementation (L598-673)**: Cross-platform socket pair creation with fallback

### Sendfile Implementation
- **_sendfile_use_sendfile (L350-417)**: OS sendfile() optimization
- **_sendfile_use_send (L419-453)**: Fallback using socket.send()
- Automatic fallback via `_GiveupOnSendfile` exception (L212)

## Dependencies
- `_socket`: Low-level socket implementation
- `io`: Stream I/O interfaces  
- `selectors`: I/O multiplexing for sendfile
- `os`: File descriptor and platform operations
- `enum`: IntEnum/IntFlag for constants

## Architecture Patterns
- **Wrapper Pattern**: Enhances low-level `_socket` with Python conveniences
- **Strategy Pattern**: Multiple sendfile implementations with automatic fallback
- **Reference Counting**: I/O reference management for proper socket cleanup
- **Platform Abstraction**: Conditional implementations for Windows/Unix differences

## Critical Invariants
- Socket cleanup requires I/O reference count to reach zero
- Enum conversion preserves unknown numeric values as integers
- File-like interfaces maintain socket timeout behavior
- Non-blocking socket operations return None for EAGAIN/EWOULDBLOCK
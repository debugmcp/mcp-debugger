# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/socket.py
@source-hash: b1d5ea1854877f0c
@generated: 2026-02-09T18:08:10Z

## Purpose
High-level Python socket interface wrapping the low-level `_socket` module. Provides cross-platform socket operations with enhanced functionality like file-like interface, sendfile optimization, and platform-specific error handling.

## Key Components

### Main Socket Class
- **socket (L215-541)**: Enhanced wrapper around `_socket.socket`
  - Adds context manager support (`__enter__`/`__exit__` L237-242)
  - Provides file-like interface via `makefile()` (L304-346)
  - Implements efficient file transfer with `sendfile()` (L468-489)
  - Platform-specific sendfile implementations: `_sendfile_use_sendfile()` (L350-413) and `_sendfile_use_send()` (L419-453)
  - Enhanced `accept()` method (L288-302) that handles timeout inheritance
  - Custom `__repr__()` (L244-272) showing connection details

### I/O Stream Implementation
- **SocketIO (L677-791)**: Raw I/O implementation for socket file objects
  - Implements `io.RawIOBase` interface for `makefile()` support
  - Handles socket-specific I/O with timeout and non-blocking behavior
  - Methods: `readinto()` (L706-727), `write()` (L729-743)

### Utility Functions
- **create_connection() (L823-871)**: High-level connection establishment with timeout/source address support
- **create_server() (L890-956)**: Server socket creation with platform-specific optimizations
- **getfqdn() (L794-818)**: Fully qualified domain name resolution
- **has_dualstack_ipv6() (L874-887)**: IPv4/IPv6 dual-stack capability detection

### Platform Compatibility
- **Windows Error Mapping (L112-209)**: Comprehensive WSA error code translations
- **Socket Pair Implementation**: Native `socketpair()` (L652-662) with fallback `_fallback_socketpair()` (L598-650)
- **File Descriptor Operations**: `fromfd()` (L542-549), `send_fds()`/`recv_fds()` (L554-583)

### Enum Conversions
- **AddressFamily/SocketKind/MsgFlag/AddressInfo (L76-94)**: IntEnum conversions for better string representations
- **_intenum_converter() (L100-108)**: Helper for enum value conversion

## Dependencies
- Core: `_socket`, `os`, `sys`, `io`, `selectors`
- Optional: `errno` (with fallback constants L58-64)
- Conditional: `array` (for FD passing on Unix)

## Architecture Patterns
- Wrapper pattern: Extends `_socket.socket` functionality while maintaining compatibility
- Factory pattern: Multiple construction methods (`fromfd`, `fromshare`, `socketpair`)
- Strategy pattern: Platform-specific implementations (sendfile, inheritability)
- Reference counting: `_io_refs` tracking for proper cleanup

## Critical Constraints
- Non-blocking sockets not supported for sendfile operations
- File objects must be opened in binary mode for sendfile
- Only SOCK_STREAM sockets supported for sendfile
- Platform-specific behavior for socket inheritance and error codes
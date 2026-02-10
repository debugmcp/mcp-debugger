# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/socket.py
@source-hash: b1d5ea1854877f0c
@generated: 2026-02-09T18:09:15Z

## Python Socket Module

**Purpose**: High-level wrapper around the low-level `_socket` module, providing enhanced socket operations and platform-independent functionality with improved error handling and convenience features.

### Key Components

**Core Socket Class**
- `socket` class (L215-541): Enhanced wrapper around `_socket.socket` with additional Python-level features
  - Adds context manager support (`__enter__`/`__exit__` L237-242)
  - Provides `makefile()` method (L304-346) for file-like I/O operations
  - Implements `sendfile()` (L468-489) for efficient file transmission
  - Enhanced `__repr__` (L244-272) showing socket state and addresses
  - Reference counting for I/O objects (`_io_refs`, `_decref_socketios` L491-495)

**I/O Support**
- `SocketIO` class (L677-791): Raw I/O implementation for stream sockets
  - Implements `io.RawIOBase` interface for socket-based file operations
  - Handles timeout scenarios and non-blocking operations
  - Provides `readinto()` (L706-727) and `write()` (L729-743) methods

**High-Level Functions**
- `create_connection()` (L823-871): Convenience function for client socket creation with timeout/source address support
- `create_server()` (L890-956): Server socket creation with advanced options (dual-stack IPv6, port reuse)
- `getfqdn()` (L794-818): Fully qualified domain name resolution
- `socketpair()` (L653-662): Cross-platform socket pair creation

**Platform Compatibility**
- Windows error code mapping (L112-209): WSA error translations for better error messages
- Fallback `socketpair` implementation (L598-650): Pure Python implementation for platforms lacking native support
- Platform-specific inheritable flag handling (L529-540)

**Enum Conversions**
- `AddressFamily`, `SocketKind`, `MsgFlag`, `AddressInfo` enums (L76-94): Convert raw integer constants to meaningful enums
- `_intenum_converter()` (L100-108): Safely converts numeric values to enum members

**File Descriptor Operations**
- `fromfd()` (L542-549): Create socket from existing file descriptor
- `send_fds()`/`recv_fds()` (L554-583): Unix domain socket file descriptor passing (when available)
- `fromshare()` (L585-593): Windows socket sharing support

### Dependencies
- Core: `_socket`, `os`, `sys`, `io`, `selectors`, `enum`
- Optional: `errno`, `array` (for FD passing)

### Architecture Notes
- Uses composition pattern: wraps `_socket.socket` rather than pure inheritance
- Implements reference counting for I/O objects to prevent premature socket closure
- Graceful fallback mechanisms for platform-specific features
- Extensive error handling and platform compatibility layers

### Critical Constraints
- Socket must be SOCK_STREAM type for sendfile operations (L458)
- Non-blocking sockets not supported for sendfile (L367, L421)
- File objects for sendfile must be opened in binary mode (L456)
- I/O reference counting prevents socket closure while file objects exist
# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/socket.py
@source-hash: b1d5ea1854877f0c
@generated: 2026-02-09T18:07:31Z

## Primary Purpose
Python socket module wrapper that extends the low-level `_socket` module with higher-level socket operations, I/O interfaces, and platform-specific error handling. Provides enhanced socket objects with file-like interfaces and cross-platform compatibility.

## Key Classes

**socket (L215-541)** - Main socket wrapper class extending `_socket.socket`
- Constructor (L221-235): Creates socket with IntEnum family/type conversion, defaults to AF_INET/SOCK_STREAM
- Context manager support (L237-242): `__enter__`/`__exit__` for resource cleanup
- Enhanced repr (L244-272): Shows socket state, addresses, and connection info
- File operations:
  - `makefile()` (L304-346): Creates file-like I/O wrapper with buffering/encoding support
  - `sendfile()` (L468-489): High-performance file transmission with OS-specific optimization
- Connection handling:
  - `accept()` (L288-302): Returns new socket instance with timeout inheritance
  - `dup()` (L277-286): Creates duplicate socket with same properties
- Properties:
  - `family`/`type` (L517-527): IntEnum conversion of socket parameters
  - Platform-specific inheritable flag methods (L529-540)

**SocketIO (L677-791)** - Raw I/O interface for sockets
- Constructor (L694-704): Mode validation and socket wrapping
- I/O methods:
  - `readinto()` (L706-727): Non-blocking read with timeout handling
  - `write()` (L729-743): Non-blocking write with error handling
- Properties: `readable()`, `writable()`, `seekable()`, `fileno()`, `name`, `mode`

## Key Functions

**create_connection() (L823-871)** - High-level client connection helper
- Address resolution via `getaddrinfo()`
- Timeout and source address binding support
- Error aggregation with `all_errors` parameter

**create_server() (L890-956)** - Server socket creation and binding
- IPv4/IPv6 dual-stack support via `dualstack_ipv6` parameter
- Platform-specific socket option handling (SO_REUSEADDR, SO_REUSEPORT)
- Comprehensive error handling with context

**socketpair() (L653-665)** - Cross-platform socket pair creation
- Falls back to `_fallback_socketpair()` (L598-650) when native support unavailable
- Uses TCP localhost connections for compatibility

**File descriptor operations:**
- `fromfd()` (L542-549): Create socket from file descriptor
- `send_fds()`/`recv_fds()` (L554-583): Unix domain socket FD passing
- `fromshare()` (L586-592): Windows socket sharing support

**Utility functions:**
- `getfqdn()` (L794-818): Fully qualified domain name resolution
- `has_dualstack_ipv6()` (L874-887): Platform capability detection
- `_intenum_converter()` (L100-108): Numeric to IntEnum conversion helper

## Important Dependencies
- `_socket`: Core C extension module
- `os`, `sys`, `io`: System interfaces
- `selectors`: I/O multiplexing for sendfile operations
- `enum.IntEnum`, `enum.IntFlag`: Type-safe constants
- `errno`: Error code handling (optional import)

## Notable Patterns
- IntEnum conversion layer (L76-94): Converts socket constants to enums for better debugging
- Platform-specific code paths: Windows error table (L112-209), inheritable flags (L529-540)
- Graceful fallbacks: sendfile to send(), native to fallback socketpair()
- Resource management: Reference counting for SocketIO objects (L491-495)
- Error handling: Platform-specific WSA error messages, timeout tracking

## Critical Invariants
- Socket objects maintain `_io_refs` counter for proper cleanup
- `_closed` flag prevents operations on closed sockets
- File-like objects created by `makefile()` must be properly closed to decrement references
- sendfile() requires binary mode files and SOCK_STREAM sockets
- Non-blocking sockets not supported for sendfile operations

## Constants
- `_LOCALHOST`/`_LOCALHOST_V6` (L96-97): Default addresses for socketpair fallback
- `_GLOBAL_DEFAULT_TIMEOUT` (L821): Sentinel for default timeout behavior
- `_blocking_errnos` (L675): Error codes indicating non-blocking operation
- Platform-specific error mappings in `errorTab` (Windows only)
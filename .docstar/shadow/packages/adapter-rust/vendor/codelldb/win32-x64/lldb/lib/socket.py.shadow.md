# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/socket.py
@source-hash: b1d5ea1854877f0c
@generated: 2026-02-09T18:13:16Z

## Socket Module - Python Socket Wrapper

**Primary Purpose**: High-level Python wrapper around the low-level `_socket` module, providing enhanced socket operations with Python-friendly interfaces and additional functionality.

### Key Components

#### Core Socket Class
- **`socket` class (L215-540)**: Main socket wrapper extending `_socket.socket`
  - Adds file-like interface via `makefile()` (L304-346)
  - Implements context manager protocol (`__enter__`/`__exit__` L237-242)
  - Enhanced `__repr__` with readable family/type names (L244-272)
  - File transfer via `sendfile()` (L468-489) with OS-specific optimizations
  - Reference counting for I/O objects (`_io_refs`, `_decref_socketios()` L491-495)

#### Enum Conversions (L76-94)
- Converts `_socket` integer constants to IntEnum for better representations:
  - `AddressFamily` (AF_INET, AF_UNIX, etc.)
  - `SocketKind` (SOCK_STREAM, SOCK_DGRAM, etc.) 
  - `MsgFlag` and `AddressInfo` flags

#### File Descriptor Operations
- **`send_fds()` (L554-560)**: Send file descriptors over AF_UNIX sockets
- **`recv_fds()` (L566-582)**: Receive file descriptors from AF_UNIX sockets
- **`fromfd()` (L542-549)**: Create socket from existing file descriptor
- **`fromshare()` (L586-592)**: Windows-specific socket sharing

#### Network Utilities
- **`getfqdn()` (L794-818)**: Get fully qualified domain name
- **`create_connection()` (L823-871)**: High-level client connection helper
- **`create_server()` (L890-956)**: High-level server creation with IPv6 dualstack support
- **`has_dualstack_ipv6()` (L874-887)**: Platform capability detection

#### I/O Implementation
- **`SocketIO` class (L677-791)**: Raw I/O interface for socket file-like operations
  - Implements `readinto()` (L706-727) and `write()` (L729-743)
  - Handles socket timeouts and non-blocking behavior
  - Integrates with socket reference counting

#### Fallback Implementations
- **`_fallback_socketpair()` (L598-650)**: Pure Python socketpair for platforms lacking native support
- Platform-specific socketpair wrapper (L652-665)

### Platform-Specific Features

#### Windows Support
- **WSA Error Table (L112-209)**: Comprehensive Windows Socket error code mappings
- Handle inheritance methods for Windows vs Unix (L529-540)

#### sendfile() Optimizations
- **`_sendfile_use_sendfile()` (L350-413)**: OS-level sendfile() with timeout handling
- **`_sendfile_use_send()` (L419-453)**: Fallback using regular send() calls
- Automatic fallback via `_GiveupOnSendfile` exception (L212)

### Dependencies
- **Core**: `_socket` (low-level socket implementation), `os`, `sys`, `io`, `selectors`
- **Optional**: `errno` module with graceful fallback
- **Conditional**: `array` module for file descriptor passing

### Architectural Patterns
- **Wrapper Pattern**: Extends `_socket.socket` while maintaining compatibility
- **Template Method**: sendfile() with platform-specific implementations
- **Factory Functions**: `create_connection()`, `create_server()` for common use cases
- **Reference Counting**: Manages socket lifecycle with I/O object references

### Critical Constraints
- Socket must be SOCK_STREAM for sendfile operations (L458)
- Non-blocking sockets not supported for sendfile (L367, L421)
- File objects must be opened in binary mode for sendfile (L456)
- IPv6 dualstack requires AF_INET6 family (L914)
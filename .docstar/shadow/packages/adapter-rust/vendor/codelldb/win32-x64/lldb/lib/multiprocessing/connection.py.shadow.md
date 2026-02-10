# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/connection.py
@source-hash: 3b1591b340a6e8f6
@generated: 2026-02-09T18:11:29Z

## Primary Purpose
Cross-platform interprocess communication module providing high-level connection abstractions over sockets (Unix) and named pipes (Windows). Handles message framing, authentication, and platform-specific transport mechanisms.

## Core Connection Classes

### _ConnectionBase (L115-264)
Abstract base class defining common connection interface:
- **Properties**: `closed`, `readable`, `writable` (L155-167)
- **Core methods**: `send()`, `recv()`, `send_bytes()`, `recv_bytes()` (L202-251)
- **Message framing**: Automatic pickling/unpickling with `_ForkingPickler`
- **Context manager**: `__enter__`/`__exit__` support (L259-263)

### PipeConnection (L268-362) - Windows Only
Windows named pipe implementation with overlapped I/O:
- **Async operations**: Uses `_winapi.WriteFile`/`ReadFile` with overlapped structures
- **Send mechanism**: `_send_bytes()` with concurrent call protection (L284-308)
- **Receive mechanism**: `_recv_bytes()` with message continuation handling (L310-340)
- **Polling**: `_poll()` using `PeekNamedPipe` (L342-346)

### Connection (L364-441) - Universal
Socket/file descriptor based connection:
- **Platform adaptation**: Different `_close`/`_read`/`_write` methods for Windows vs Unix (L370-379)
- **Message protocol**: Length-prefixed binary format with size headers (L406-437)
- **Large message support**: Handles >2GB messages with extended headers (L408-413)

## Factory Functions

### Client (L510-528)
Connection factory that auto-detects address family and creates appropriate client connection.

### Listener (L448-507)
Server-side connection acceptor with authentication support:
- **Multi-family support**: Wraps `SocketListener` or `PipeListener` based on address type
- **Authentication**: Optional challenge-response using `deliver_challenge()` (L481-483)

### Pipe (L533-590)
Creates bidirectional or unidirectional connection pairs:
- **Unix**: Uses `socketpair()` or `os.pipe()` (L533-548)  
- **Windows**: Creates named pipe with overlapped I/O (L552-590)

## Address Management

### address_type (L96-109)
Determines connection family from address format:
- Tuple → `AF_INET`
- String starting with `\\` → `AF_PIPE` 
- Other strings → `AF_UNIX`

### arbitrary_address (L70-82)
Generates platform-appropriate free addresses using temp files for Unix sockets and unique pipe names.

## Authentication Protocol (L742-965)

### Core Functions
- **deliver_challenge()** (L928-946): Server sends cryptographic challenge
- **answer_challenge()** (L949-964): Client responds to challenge
- **Protocol**: Length-prefixed messages with HMAC verification using configurable digest algorithms

### Security Features
- **Multi-algorithm support**: MD5, SHA256, SHA384, SHA3 variants (L836-837)
- **Legacy compatibility**: Supports older MD5-only protocol (L844-846)
- **Digest negotiation**: Modern protocol includes `{digest}` prefixes (L849-872)

## Cross-Platform Wait Implementation

### Windows wait() (L1032-1108)
- **Overlapped I/O**: Uses `WaitForMultipleObjects` with zero-length reads
- **Handle management**: Maps wait handles to objects, handles pipe-specific states
- **Empty message detection**: Special handling for zero-length pipe messages

### Unix wait() (L1122-1143)
- **Selector-based**: Uses `PollSelector` or `SelectSelector` for efficient polling
- **Timeout handling**: Monotonic clock-based deadline calculation

## Platform Detection and Constants

### Family Support (L48-57)
- **Default families**: `AF_INET` (universal), `AF_UNIX` (Unix), `AF_PIPE` (Windows)
- **Runtime detection**: Checks socket module capabilities and platform

### Configuration
- **BUFSIZE**: 8192 bytes default buffer size (L42)
- **CONNECTION_TIMEOUT**: 20 seconds for local connections (L44)
- **MESSAGE_LENGTH**: 40 bytes minimum for authentication (L743)

## Serialization Extensions (L970-1002)
XML-RPC wrapper classes `XmlListener`/`XmlClient` that replace pickle with XML-RPC serialization while maintaining the same interface.
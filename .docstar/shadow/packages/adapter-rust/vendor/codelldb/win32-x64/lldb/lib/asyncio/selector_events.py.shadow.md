# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/selector_events.py
@source-hash: a32d9cc6afcc03d3
@generated: 2026-02-09T18:12:34Z

## Primary Purpose
Implements selector-based event loop for asyncio, providing the core I/O multiplexing functionality. Uses selectors to monitor file descriptors for read/write events and manages socket-based transports for TCP/UDP communication.

## Key Components

### BaseSelectorEventLoop (L53-767)
Main event loop class inheriting from BaseEventLoop, providing selector-based I/O event handling:

- `__init__(selector=None)` (L59): Initializes with DefaultSelector, creates self-pipe for thread safety
- `_make_socket_transport()` (L69), `_make_ssl_transport()` (L75), `_make_datagram_transport()` (L93): Factory methods for transport creation
- `close()` (L99): Cleanup sequence - closes self-pipe and selector
- `_make_self_pipe()` (L118): Creates socketpair for cross-thread communication
- `_accept_connection()` (L167): Handles incoming connections with backlog loop and resource exhaustion handling
- `_accept_connection2()` (L213): Async coroutine for connection setup with SSL support
- Socket I/O methods: `sock_recv()` (L374), `sock_sendall()` (L536), `sock_connect()` (L631), `sock_accept()` (L704)
- Selector management: `_add_reader()` (L278), `_remove_reader()` (L294), `_add_writer()` (L315), `_remove_writer()` (L331)
- `_process_events()` (L750): Main event processing loop handling read/write events from selector

### _SelectorTransport (L769-929)
Base transport class with flow control and connection management:

- `__init__(loop, sock, protocol, extra=None, server=None)` (L779): Sets up socket info, protocol binding, and buffer initialization
- Connection lifecycle: `close()` (L867), `_force_close()` (L896), `_call_connection_lost()` (L908)
- Flow control: `pause_reading()` (L851), `resume_reading()` (L859)
- Buffer management: `get_write_buffer_size()` (L922)

### _SelectorSocketTransport (L931-1211)
TCP socket transport with optimized write operations:

- Dual read modes: `_read_ready__get_buffer()` (L972) for BufferedProtocol, `_read_ready__data_received()` (L1009) for regular protocols
- Write optimization: `write()` (L1055) tries immediate send before buffering
- Two write strategies: `_write_sendmsg()` (L1097) using sendmsg() for vectorized I/O, `_write_send()` (L1136) using regular send()
- EOF handling: `write_eof()` (L1167), `_read_ready__on_eof()` (L1034)
- Sendfile support: `_make_empty_waiter()` (L1196) for coordinating with sendfile operations

### _SelectorDatagramTransport (L1213-1321)
UDP socket transport for datagram communication:

- `_read_ready()` (L1234): Handles incoming datagrams with error propagation
- `sendto()` (L1250): Immediate send attempt with address validation, falls back to buffering
- `_sendto_ready()` (L1294): Processes buffered datagrams with retry logic

## Architecture Patterns

**Self-pipe mechanism**: Uses socketpair for thread-safe event loop wakeup across platforms
**Transport factories**: Centralized creation with proper error handling and resource tracking
**Optimistic I/O**: Attempts immediate operations before falling back to selector monitoring
**Dual-mode protocols**: Supports both regular and buffered protocol interfaces
**Resource management**: Tracks transports by file descriptor, prevents double-registration

## Critical Dependencies

- `selectors` module for cross-platform I/O multiplexing
- Internal asyncio modules: `base_events`, `transports`, `protocols`, `sslproto`
- Socket operations with proper non-blocking error handling
- Optional SSL support with conditional imports

## Key Constraints

- All sockets must be non-blocking
- File descriptors cannot be shared between transports
- Self-pipe mechanism required for cross-thread safety
- Platform-specific optimizations (sendmsg availability via `_HAS_SENDMSG`)

## Utility Functions

- `_test_selector_event(selector, fd, event)` (L42): Tests if selector monitors specific event on fd
# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/base_events.py
@source-hash: d6b57afdbf9899d3
@generated: 2026-02-09T18:11:33Z

## Core Purpose

Base implementation of Python asyncio event loop with abstract methods for platform-specific I/O multiplexing. Provides the foundation for scheduling callbacks, managing timers, and orchestrating asynchronous I/O operations.

## Key Classes

### BaseEventLoop (L409-2011)
Core event loop implementation extending `events.AbstractEventLoop`. Manages callback scheduling, timer handling, and provides high-level async operations.

**Critical State**:
- `_ready` (L415): FIFO queue of callbacks ready to execute
- `_scheduled` (L416): Heap queue of timer handles sorted by execution time
- `_thread_id` (L421): Identifies thread running the loop (None when not running)
- `_closed`/`_stopping` (L413-414): Loop lifecycle flags

**Core Methods**:
- `run_forever()` (L627): Main event loop that processes callbacks until stopped
- `_run_once()` (L909): Single iteration processing ready callbacks and I/O events
- `create_task()` (L451): Creates Task from coroutine with optional name/context
- `call_soon()`/`call_later()`/`call_at()` (L785/743/767): Schedule callbacks
- Timer cleanup optimization (L918-938): Removes cancelled timers when threshold exceeded

### Server (L276-407)
TCP server wrapper managing multiple listening sockets and connection lifecycle.

**Key Features**:
- `_start_serving()` (L312): Begins accepting connections on all sockets
- `serve_forever()` (L360): Runs server until explicitly cancelled
- `wait_closed()` (L381): Waits for server shutdown and all connections to close
- Connection counting via `_attach()`/`_detach()` (L295/299)

### _SendfileFallbackProtocol (L208-274)
Protocol adapter for sendfile operations when native sendfile unavailable. Manages flow control during file transmission.

## Network Operations

**Connection Creation** (L1020-1158):
- `create_connection()`: Creates TCP client connections with Happy Eyeballs support
- Address resolution optimization via `_ipaddr_info()` (L101) to skip DNS when possible
- `_interleave_addrinfos()` (L160): IPv4/IPv6 address interleaving for dual-stack

**Server Creation** (L1466-1603):
- `create_server()`: Creates TCP servers with multi-host binding
- Socket option management (reuse_address, reuse_port, IPv6_V6ONLY)
- Error handling for address binding failures

**Datagram Support** (L1312-1444):
- `create_datagram_endpoint()`: UDP socket creation and binding
- Unix socket support with automatic cleanup

## File Operations

**Sendfile Implementation** (L1188-1262):
- `sendfile()`: High-performance file transmission with fallback
- `_sock_sendfile_fallback()`: Manual read/write when native sendfile unavailable
- Parameter validation for binary mode, socket type, offset/count

## Process Management

**Subprocess Support** (L1680-1748):
- `subprocess_shell()`/`subprocess_exec()`: Async subprocess creation
- Strict parameter validation (no text mode, encoding, universal_newlines)
- Debug logging with security consideration for sensitive parameters

## Utility Functions

**Socket Utilities**:
- `_set_nodelay()` (L193/199): TCP_NODELAY optimization when available
- `_set_reuseport()` (L90): SO_REUSEPORT with availability checks
- `_check_ssl_socket()` (L203): Validates against SSLSocket usage

**Address Resolution**:
- `_ipaddr_info()` (L101): Fast path for already-resolved IP addresses
- IPv6 zone index handling and IDNA decoding

## Executor Integration

**Thread Pool Management** (L849-868):
- `run_in_executor()`: Execute blocking operations in thread pool
- Automatic ThreadPoolExecutor creation with "asyncio" prefix
- `shutdown_default_executor()` (L586): Graceful executor shutdown with timeout

## Exception Handling

**Comprehensive Error Management** (L1772-1892):
- `default_exception_handler()`: Logs unhandled exceptions with context
- `call_exception_handler()`: Routes to custom or default handlers
- Context extraction from Tasks/Futures/Handles for better debugging
- Stack trace formatting for object creation tracking

## Abstract Methods (Platform-Specific)

Methods requiring implementation by platform-specific subclasses:
- `_make_*_transport()` methods (L490-524): Transport creation
- `_write_to_self()` (L526): Self-pipe signaling for thread safety
- `_process_events()` (L535): Process selector events

## Performance Optimizations

- Timer handle cleanup when cancellation ratio exceeds 50% (L918-932)
- Address interleaving for Happy Eyeballs (L160-179)
- IP address pre-validation to skip getaddrinfo (L101-157)
- Coroutine origin tracking management (L1989-2002)
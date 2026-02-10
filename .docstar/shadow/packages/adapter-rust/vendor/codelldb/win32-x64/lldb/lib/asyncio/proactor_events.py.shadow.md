# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/proactor_events.py
@source-hash: 62d15e99315cae52
@generated: 2026-02-09T18:10:27Z

## Primary Purpose
Windows-specific asyncio event loop implementation using proactor pattern with IOCP (I/O Completion Ports). Provides transport classes and event loop for asynchronous I/O operations on Windows.

## Key Classes and Components

### Transport Classes
- **_ProactorBasePipeTransport (L46-179)**: Base transport for pipes and sockets with flow control, connection management, and error handling
- **_ProactorReadPipeTransport (L181-326)**: Read-only pipe transport with buffering, pause/resume capabilities, and data reception handling
- **_ProactorBaseWritePipeTransport (L328-436)**: Write-only pipe transport with write buffering, EOF handling, and flow control
- **_ProactorWritePipeTransport (L438-458)**: Concrete write pipe transport that monitors for pipe closure
- **_ProactorDatagramTransport (L460-590)**: UDP socket transport with datagram buffering and address validation
- **_ProactorDuplexPipeTransport (L592-602)**: Bidirectional pipe transport combining read/write capabilities
- **_ProactorSocketTransport (L604-628)**: TCP socket transport with sendfile compatibility

### Event Loop
- **BaseProactorEventLoop (L630-897)**: Main event loop implementation with proactor-based I/O operations, socket handling, SSL support, and server management

## Key Functions
- **_set_socket_extra (L28-44)**: Utility to populate transport metadata with socket information
- **_loop_reading (L276-326, L548-590)**: Core read operation handlers with error handling and data delivery
- **_loop_writing (L376-416, L514-547)**: Core write operation handlers with buffering and flow control
- **_make_*_transport methods (L645-683)**: Factory methods for creating specific transport types

## Critical Architecture Patterns
- **Proactor Pattern**: Notify-on-completion I/O model using Windows IOCP
- **Future-based Operations**: All I/O operations return futures that complete when operation finishes
- **Flow Control**: Automatic protocol pausing/resuming based on buffer levels
- **Error Handling**: Comprehensive exception handling with connection loss detection
- **Transport Lifecycle**: Connection establishment → data transfer → graceful/forced closure

## Important Dependencies
- Relies on proactor implementation (typically IocpProactor on Windows)
- Uses asyncio base classes (base_events, transports, protocols)
- Socket operations through low-level proactor interface
- SSL support via sslproto module

## Critical Invariants
- Only one read/write operation active per transport at a time
- Buffer management prevents memory leaks during high-load scenarios  
- Connection state tracking prevents operations on closed transports
- Protocol callbacks executed in correct order during connection lifecycle
- Self-pipe mechanism ensures thread-safe event loop wakeup
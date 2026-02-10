# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/windows_events.py
@source-hash: 163927e5834c10c6
@generated: 2026-02-09T18:10:27Z

## Purpose
Windows-specific asyncio event loop implementations providing both selector-based and proactor-based (IOCP) event loops for Windows platforms. Only importable on Windows systems (L5-6).

## Key Components

### Future Classes
- **_OverlappedFuture** (L49-95): Future subclass for Windows overlapped I/O operations with automatic cancellation support
- **_BaseWaitHandleFuture** (L97-169): Base future for Windows wait handle operations with registration/unregistration management
- **_WaitCancelFuture** (L171-193): Non-cancellable future for wait cancellation events
- **_WaitHandleFuture** (L195-245): Full wait handle future with event-based cleanup

### Server Infrastructure
- **PipeServer** (L247-304): Named pipe server implementation with connection management and weak reference tracking of free instances

### Event Loop Implementations
- **_WindowsSelectorEventLoop** (L306-308): Empty Windows selector event loop class
- **ProactorEventLoop** (L310-414): Windows proactor event loop using IOCP with pipe connection support and subprocess management
- **_WindowsSubprocessTransport** (L875-887): Windows subprocess transport using process handle waiting

### Core IOCP Proactor
- **IocpProactor** (L416-873): Main Windows I/O Completion Port implementation providing:
  - Socket operations: recv/send/connect/accept (L482-605)
  - File operations: sendfile (L607-617) 
  - Named pipe operations: accept_pipe/connect_pipe (L619-653)
  - Handle waiting: wait_for_handle (L655-702)
  - Registration/polling: _register/_poll (L714-817)

### Policy Classes
- **WindowsSelectorEventLoopPolicy** (L893-894): Policy for selector-based loops
- **WindowsProactorEventLoopPolicy** (L897-898): Policy for proactor-based loops
- **DefaultEventLoopPolicy** (L901): Alias for WindowsProactorEventLoopPolicy

## Architecture Patterns
- Uses Windows IOCP for asynchronous I/O operations
- Overlapped I/O with completion callbacks
- Weak reference management for resource cleanup
- Retry logic for named pipe connections with exponential backoff (L637-651)
- Exception handling with context propagation to event loop

## Key Dependencies
- `_overlapped`, `_winapi`: Windows-specific low-level modules
- Standard asyncio modules: events, futures, tasks, exceptions
- Windows utilities: windows_utils module

## Constants
- Connection timeouts: CONNECT_PIPE_INIT_DELAY (0.001s), CONNECT_PIPE_MAX_DELAY (0.1s)
- Error codes: ERROR_CONNECTION_REFUSED (1225), ERROR_CONNECTION_ABORTED (1236)
- Windows constants: NULL, INFINITE from _winapi
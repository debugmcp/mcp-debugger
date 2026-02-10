# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/base_subprocess.py
@source-hash: d69ba8f97bf8c895
@generated: 2026-02-09T18:11:25Z

## Base Subprocess Transport Implementation

This file provides the foundation for asyncio subprocess transport functionality, implementing the core transport layer for managing child processes with bidirectional pipe communication.

### Primary Components

**BaseSubprocessTransport (L10-253)**: Core transport class that manages subprocess lifecycle and pipe communications. Inherits from `transports.SubprocessTransport` and serves as the primary interface between asyncio event loops and child processes.

Key initialization parameters (L12-14):
- `loop`: asyncio event loop
- `protocol`: protocol instance for handling process events
- `args`, `shell`: subprocess execution parameters
- `stdin/stdout/stderr`: pipe configurations
- `waiter`: optional future for connection completion

**Critical State Management**:
- `_proc` (L19): underlying subprocess.Popen instance  
- `_pid` (L20): process ID
- `_returncode` (L21): exit status when process completes
- `_pipes` (L24): dict mapping file descriptors (0,1,2) to pipe protocol instances
- `_pending_calls` (L23): deque for calls queued before pipe connection
- `_exit_waiters` (L22): futures waiting for process completion

### Key Methods

**Lifecycle Management**:
- `_start()` (L84-85): Abstract method for platform-specific subprocess creation
- `close()` (L96-122): Graceful shutdown with process termination if still running
- `_connect_pipes()` (L156-193): Async pipe setup connecting stdin/stdout/stderr to event loop

**Process Control**:
- `send_signal()`, `terminate()`, `kill()` (L144-154): Signal operations with process validation
- `_wait()` (L221-230): Async wait for process completion returning exit code
- `_process_exited()` (L207-219): Handler for process termination events

**Pipe Communication**:
- `_pipe_data_received()` (L204-205): Forward received data to protocol
- `_pipe_connection_lost()` (L200-202): Handle pipe disconnection and attempt completion
- `_try_finish()` (L232-239): Check if all pipes closed and process exited to finalize transport

### Protocol Classes

**WriteSubprocessPipeProto (L255-279)**: Protocol for stdin pipe handling. Manages write transport connection and flow control (pause/resume writing). Inherits from `protocols.BaseProtocol`.

**ReadSubprocessPipeProto (L281-285)**: Protocol for stdout/stderr pipe handling. Extends `WriteSubprocessPipeProto` and `protocols.Protocol`, adding `data_received()` method to forward incoming data to the subprocess transport.

### Architectural Patterns

**Deferred Execution**: Uses `_pending_calls` deque to queue protocol callbacks until pipe connections are established, then replays them via `_call()` method (L194-198).

**Resource Management**: Implements proper cleanup in `__del__` (L123-126) with ResourceWarning for unclosed transports. The `close()` method ensures graceful shutdown by terminating running processes and closing all pipe transports.

**Event-Driven Communication**: All protocol interactions are scheduled through the event loop using `call_soon()` to maintain asyncio's single-threaded execution model.

### Dependencies

- `collections.deque` for pending call queue
- `subprocess` module for process management  
- Local modules: `protocols`, `transports`, `log`
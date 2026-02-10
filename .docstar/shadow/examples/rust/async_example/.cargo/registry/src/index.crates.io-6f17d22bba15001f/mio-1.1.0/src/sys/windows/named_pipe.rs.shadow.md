# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/named_pipe.rs
@source-hash: 3380bee2c3faa9b1
@generated: 2026-02-09T18:03:26Z

## Windows Named Pipe Implementation for Mio

This module provides a non-blocking named pipe implementation for Windows that bridges IOCP (completion-based model) to mio's readiness-based model through internal buffering.

### Key Structures

**NamedPipe (L72-74)**: Main public structure wrapping an `Arc<Inner>` for thread-safe access to the underlying named pipe handle.

**Inner (L81-93)**: Core structure with critical memory layout requirements (marked `#[repr(C)]`):
- Four `Overlapped` instances for different I/O operations (connect, read, write, event) at fixed offsets
- Windows `Handle` for the pipe
- Atomic connection state tracking
- Mutex-protected I/O state and buffer pool

**Io (L344-352)**: I/O state management containing completion port reference, token, read/write states, and connection errors.

**State (L355-360)**: Enum tracking asynchronous operation states (None, Pending, Ok, Err).

**BufferPool (L1056-1081)**: Simple buffer recycling system to avoid frequent allocations.

### Key Operations

**Creation & Connection**:
- `new()` (L372-397): Creates server-side named pipe with overlapped I/O flags
- `connect()` (L419-460): Initiates asynchronous client connection using atomic state management
- `disconnect()` (L482-484): Disconnects from client

**I/O Operations**:
- Overlapped read/write methods (L201-233, L261-293) handle immediate completion vs. pending states
- `Read`/`Write` trait implementations (L510-613) manage internal buffering and state transitions
- Buffer management through get_buffer/put_buffer (L821-827)

### IOCP Integration

**Completion Handlers**:
- `connect_done()` (L841-865): Handles connection completion, manages reference counting
- `read_done()` (L867-910): Processes read completions, updates buffer states
- `write_done()` (L912-961): Handles write completions, potentially schedules additional writes
- `event_done()` (L963-987): Processes custom events with token manipulation

**Pointer Recovery**: Critical unsafe methods (L109-130) recover `Inner` pointers from overlapped structures using fixed memory layout assumptions, verified by test at L321-342.

### Mio Integration

**Source Implementation** (L615-673):
- `register()` creates completion port association and generates internal tokens
- Uses odd token generation pattern (L363) for named pipe identification
- Event scheduling through `schedule_event()` (L1030-1053) with bit-shifted tokens

### Memory Safety & Concurrency

- Extensive use of `Arc::from_raw`/`mem::forget` patterns for managing reference counts across async operations
- Atomic boolean for connection state synchronization
- Mutex protection for I/O state and buffer pool
- Manual `Send`/`Sync` implementations with safety comments (L95-101)

### Error Handling

Handles Windows-specific errors like `ERROR_PIPE_CONNECTED`, `ERROR_IO_PENDING`, `ERROR_BROKEN_PIPE`, and `ERROR_PIPE_LISTENING` with appropriate state transitions and readiness notifications.

### Dependencies

Windows APIs via `windows_sys` crate, mio's completion port system, and internal Windows-specific event/handle abstractions.
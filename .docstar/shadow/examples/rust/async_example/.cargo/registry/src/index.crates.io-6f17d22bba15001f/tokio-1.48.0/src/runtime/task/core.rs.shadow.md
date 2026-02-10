# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/core.rs
@source-hash: 5385c4e8f681295c
@generated: 2026-02-09T18:03:13Z

## Core Task Module - Tokio's Task Memory Layout and Core Operations

This module defines the fundamental data structures and unsafe operations for Tokio's task execution system. It implements a cache-aligned memory layout optimized for different CPU architectures to avoid false sharing.

### Primary Data Structures

**Cell<T, S> (L117-126)**: The main task container struct that holds all task components in a specific memory layout. Cache-aligned with architecture-specific padding (128 bytes for x86_64/aarch64/powerpc64, 32 bytes for ARM/MIPS, etc.). Contains:
- `header`: Hot task state data
- `core`: Either the future or output depending on execution stage  
- `trailer`: Cold data used only during creation/shutdown

**Core<T, S> (L139-155)**: Contains the task's execution core including:
- `scheduler`: The scheduler driving this future
- `task_id`: Unique task identifier for JoinError population
- `spawned_at`: Source location for debugging (tokio_unstable only)
- `stage`: CoreStage wrapper containing the future or output

**Header (L159-185)**: Hot path data accessed frequently during execution:
- `state`: Current task state
- `queue_next`: Injection queue pointer
- `vtable`: Function pointers for task operations
- `owner_id`: ID of owning task list
- `tracing_id`: For instrumentation (tokio_unstable + tracing)

**Trailer (L192-199)**: Cold data for lifecycle management:
- `owned`: Linked list pointers for OwnedTasks
- `waker`: Consumer waiting on completion
- `hooks`: Task harness schedule hooks

### Key Operations

**Cell::new() (L220-310)**: Allocates and initializes a new task cell with proper memory layout. Includes debug assertions to verify pointer calculations match raw.rs constants.

**Core::poll() (L352-374)**: Polls the wrapped future with safety guarantees. Sets task ID context, handles pinning, and transitions to Consumed stage on completion.

**Core stage management (L381-421)**:
- `store_output()`: Stores task result in Finished stage
- `take_output()`: Extracts result and transitions to Consumed stage  
- `drop_future_or_output()`: Transitions to Consumed stage

**Header pointer arithmetic (L446-527)**: Unsafe methods to navigate task memory layout using vtable offsets:
- `get_trailer()`, `get_scheduler()`, `get_id_ptr()` etc.

**TaskIdGuard (L320-336)**: RAII guard that sets/restores current task ID in execution context.

### Safety Constraints

All functions are considered unsafe despite not being marked as such. The module requires careful coordination with the Harness and Lifecycle components for mutual exclusion. Memory layout must stay synchronized with const functions in raw.rs.

### Architecture Considerations

Extensive cache line alignment logic (L35-115) optimizes for different CPU architectures to prevent false sharing. Memory layout is repr(C) to ensure predictable field ordering for pointer arithmetic.
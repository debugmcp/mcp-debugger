# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/current_thread/
@generated: 2026-02-09T18:16:08Z

## Current Thread Scheduler Module

This module implements Tokio's single-threaded task scheduler that executes all tasks on the current thread without work-stealing or thread pool distribution. It provides a simpler alternative to the multi-threaded scheduler for applications that don't require parallelism or need deterministic execution ordering.

### Overall Purpose

The current thread scheduler is designed for:
- Single-threaded async applications
- Embedded systems with limited threading
- Testing scenarios requiring deterministic execution
- Applications where thread overhead outweighs parallelism benefits
- Local-only task execution without cross-thread coordination

### Core Architecture

**Scheduler Components**:
- **CurrentThread**: Main scheduler orchestrating task execution
- **Handle**: Thread-safe interface for spawning tasks and accessing scheduler services
- **Core**: Execution context containing local task queue and driver integration
- **Shared**: Cross-thread state for remote task injection and coordination
- **Context**: Thread-local scheduler state management

**Task Management**:
- Local VecDeque for efficient FIFO task execution
- Global injection queue for cross-thread task submission
- Tick-based fairness between local and global queues
- Budget-controlled execution to prevent task starvation

**Driver Integration**:
- Unified I/O and timer driver coordination
- Event-driven parking and unparking
- Blocking thread spawner for CPU-intensive operations

### Public API Surface

**Primary Entry Points**:
- `CurrentThread::new()`: Creates scheduler instance with configured drivers
- `Handle::block_on()`: Executes future to completion on current thread
- `Handle::spawn()`: Schedules task for execution, returns JoinHandle
- `Handle::spawn_local()`: Schedules !Send task for local execution

**Runtime Integration**:
- Implements `Schedule` trait for task lifecycle management
- Provides `shutdown()` for graceful cleanup
- Supports metrics collection and task hooks

### Internal Organization & Data Flow

**Execution Flow**:
1. `block_on()` acquires Core execution capability
2. Main loop alternates between task polling and driver events
3. Tasks scheduled via local queue or global injection
4. Fairness maintained through tick-based global queue checking
5. Driver parking occurs when no tasks are ready

**Concurrency Model**:
- Single-threaded execution with atomic coordination primitives
- Core ownership transfer using AtomicCell for thread safety
- Remote task submission through thread-safe injection queue
- Woken state management for efficient parking/unparking

**Resource Management**:
- RAII CoreGuard ensures proper cleanup on panic/completion
- RefCell provides thread-local borrowing semantics
- Deferred task execution prevents stack overflow

### Key Patterns

**Capability-Based Design**: Core struct serves as execution token, ensuring only one thread can run scheduler at a time.

**Context Management**: Thread-local context with proper enter/exit semantics for nested runtime scenarios.

**Fairness Guarantees**: Configurable global queue interval (default 31 ticks) prevents local queue starvation.

**Hook System**: Extensible callbacks for spawn, poll, and terminate events enabling instrumentation and debugging.

**Metrics Integration**: Comprehensive collection of scheduling statistics for performance monitoring.

This module provides the foundation for Tokio's `current_thread` runtime, offering predictable single-threaded async execution with full driver integration and runtime services.
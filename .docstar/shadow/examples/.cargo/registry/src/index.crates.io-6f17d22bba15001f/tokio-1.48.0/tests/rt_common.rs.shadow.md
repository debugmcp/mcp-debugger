# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_common.rs
@source-hash: f5e6cc48a114e584
@generated: 2026-02-09T18:12:32Z

## Primary Purpose
Test harness for Tokio runtime variants - executes comprehensive tests on both current-thread and multi-threaded schedulers to ensure runtime behavior consistency across different execution environments.

## Core Architecture

**rt_test! Macro (L8-57)**: Central testing infrastructure that generates test modules for different runtime configurations:
- `current_thread_scheduler` (L10-23): Single-threaded runtime with NUM_WORKERS=1
- `threaded_scheduler_4_threads` (L26-39): Multi-threaded runtime with 4 worker threads  
- `threaded_scheduler_1_thread` (L42-55): Multi-threaded runtime constrained to 1 thread
- Each module provides `rt()` function returning `Arc<Runtime>` with appropriate configuration

## Key Test Categories

**Basic Runtime Operations (L94-164)**:
- `block_on_sync` (L95-104): Synchronous task execution
- `block_on_async` (L109-124): Asynchronous task coordination with threads
- `spawn_one_*` tests (L127-164): Single task spawning and joining patterns

**Concurrent Task Management (L167-291)**:
- `spawn_two` (L167-187): Two-task coordination via oneshot channels
- `spawn_many_from_block_on` (L191-238): Stress test with 200 concurrent tasks
- `spawn_many_from_task` (L242-291): Nested spawning within spawned tasks (500 tasks)

**Runtime Lifecycle & Edge Cases (L334-376)**:
- `outstanding_tasks_dropped` (L334-353): Ensures task cleanup on runtime drop using Arc reference counting
- `nested_rt` (L357-362): Panics on nested runtime usage (expected behavior)
- `create_rt_in_block_on` (L365-371): Runtime creation within async context

**Performance & Load Testing (L375-472)**:
- Load simulation using infinite `yield_once()` loops (L888-900)
- Cross-thread spawning under various load conditions
- Network I/O coordination during high CPU usage

**Advanced Scenarios**:
- **Cooperative Scheduling Tests (L1200-1276)**: Budget consumption and yielding behavior
- **Panic Handling (L854-885)**: Task panic recovery and cleanup verification
- **I/O Integration (L512-607)**: TCP socket operations with async/blocking interop
- **Shutdown Behavior (L1043-1084)**: Timeout handling and graceful termination

## Helper Functions

**yield_once() (L888-900)**: Creates controlled yielding future for load testing
**client_server() (L1112-1134)**: TCP client-server pattern for network testing  
**wake_from_thread_local() (L1389-1437)**: Thread-local waker validation

## Platform Conditionals
Extensive use of `#[cfg(not(target_os="wasi"))]` for threading/networking features and `#[cfg_attr(miri, ignore)]` for socket operations, ensuring cross-platform compatibility.

## Dependencies
- `tokio::runtime::Runtime` and `Builder` for runtime construction
- `tokio::sync::{oneshot, mpsc}` for task coordination
- `tokio::net::{TcpListener, TcpStream}` for I/O testing
- `tokio_test::{assert_ok, assert_err}` for result validation
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/fs/mocks.rs
@source-hash: 5ed082250a584e71
@generated: 2026-02-09T18:06:35Z

## Purpose
Mock file system implementation for Tokio's fs module testing. Provides controlled, synchronous simulation of async file operations without actual I/O, using mockall for behavior stubbing and a task queue for execution control.

## Key Components

### MockFile (L18-57)
Generated mock struct via `mockall::mock!` macro that simulates `std::fs::File`. Key methods:
- `create()`, `open()` (L21, 32) - File creation/opening simulation
- `inner_*` methods (L27-30) - Core I/O operations (`read`, `write`, `seek`, `flush`) wrapped to support both `&mut self` and `&self` variants
- File metadata/permissions operations (L31, 34)
- Platform-specific raw handle/fd traits for Windows (L40-47) and Unix (L48-56)

### Standard Trait Implementations (L59-107)
- `Read` for `MockFile` and `&MockFile` (L59-83) - Delegates to `inner_read()` with Miri compatibility workaround
- `Seek` for `&MockFile` (L85-89) - Delegates to `inner_seek()`
- `Write` for `&MockFile` (L91-99) - Delegates to `inner_write()` and `inner_flush()`
- Unix-specific `From<MockFile> for OwnedFd` conversion (L101-107)

### Task Execution System
- **QUEUE** (L109-111) - Thread-local task queue using `VecDeque<Box<dyn FnOnce() + Send>>`
- **JoinHandle<T>** (L113-160) - Future wrapper around oneshot receiver for task results
- **spawn_blocking()** (L118-131) - Queues blocking tasks, returns handle for async polling
- **spawn_mandatory_blocking()** (L133-146) - Similar to spawn_blocking but returns `Option<JoinHandle>`

### Pool Management (L162-176)
- `len()` (L165-167) - Returns current queue length
- `run_one()` (L169-175) - Executes next queued task, panics if queue empty

## Architecture Notes
- Uses `tokio_thread_local!` macro for thread-local storage
- Separates mock definitions from trait implementations to handle Rust's orphan rule
- Inner method pattern allows uniform mocking regardless of receiver type (`&mut self` vs `&self`)
- Task queue enables deterministic execution control in tests

## Dependencies
- `mockall` for mock generation
- `tokio::sync::oneshot` for async communication
- Platform-specific imports for raw handle/fd support
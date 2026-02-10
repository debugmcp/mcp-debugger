# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/abort.rs
@source-hash: 1bc8f5ba6aaff4d8
@generated: 2026-02-09T18:03:06Z

## Purpose
Implements `AbortHandle` - a handle for remotely aborting spawned async tasks without awaiting their completion. This is part of Tokio's task management system, providing a lightweight way to cancel tasks.

## Key Components

### AbortHandle Struct (L23-25)
- Contains single field `raw: RawTask` - low-level task representation
- Provides abort permission without join/await capability (unlike JoinHandle)
- Dropping handle releases abort permission but doesn't abort the task

### Core Methods
- `new(raw: RawTask)` (L28-30): Constructor for creating handle from RawTask
- `abort()` (L53-55): Cancels associated task via `self.raw.remote_abort()`
- `is_finished()` (L63-66): Checks task completion status by loading task state
- `id()` (L72-75): Returns unique task ID using unsafe header pointer access

### Trait Implementations
- `Clone` (L99-104): Increments reference count via `self.raw.ref_inc()` and creates new handle
- `Drop` (L93-97): Calls `self.raw.drop_abort_handle()` for cleanup
- `Debug` (L84-91): Displays task ID using unsafe header pointer operations
- Thread safety: `Send + Sync` (L78-79), `UnwindSafe + RefUnwindSafe` (L81-82)

## Dependencies
- `crate::runtime::task::{Header, RawTask}` - Core task infrastructure
- `std::fmt` for Debug implementation
- `std::panic::{RefUnwindSafe, UnwindSafe}` for panic safety traits

## Critical Constraints
- **spawn_blocking tasks cannot be aborted** - only prevents unstarted blocking tasks
- Abort is asynchronous - `is_finished()` may return false even after abort called
- Uses unsafe pointer operations for task ID access with safety comments
- Reference counting managed through RawTask for clone/drop operations

## Architecture Notes
- Thin wrapper around RawTask providing safe abort interface
- Separates abort permission from join permission (design principle)
- Thread-safe design enables remote abort from any thread
- Memory management handled by underlying RawTask reference counting
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/task_local.rs
@source-hash: 72be75ead1802bc3
@generated: 2026-02-09T18:06:54Z

## Primary Purpose
Implements task-local storage for Tokio async tasks, providing a mechanism to store and access values that are scoped to individual async tasks (similar to thread-local storage but for async contexts).

## Core Components

### `task_local!` Macro (L36-48)
- Primary macro for declaring task-local keys
- Recursively processes multiple static declarations
- Delegates to `__task_local_inner!` for actual implementation
- Preserves attributes and visibility modifiers

### `__task_local_inner!` Macro (L52-63)
- Internal helper macro that creates the actual LocalKey instances
- Uses thread-local storage (`std::thread_local!`) as the underlying storage mechanism
- Each key wraps a `RefCell<Option<T>>` to handle borrowing and optional values

### `LocalKey<T>` Struct (L99-102)
- Main interface for task-local storage operations
- Wraps `thread::LocalKey<RefCell<Option<T>>>` for thread-safe access
- Provides scoped value setting and retrieval methods

#### Key Methods:
- `scope()` (L130-140): Creates async scope with task-local value
- `sync_scope()` (L168-177): Creates synchronous scope with task-local value  
- `scope_inner()` (L179-222): Core implementation using RAII Guard pattern
- `with()` (L230-238): Access value with panic on missing
- `try_with()` (L245-264): Safe access returning Result
- `get()` (L275-277): Clone and return value (for Clone types)
- `try_get()` (L285-287): Safe clone and return

### `TaskLocalFuture<T, F>` Struct (L318-328)
- Future wrapper that maintains task-local value during execution
- Uses `pin_project!` for safe pinning
- Contains value slot, future, and local key reference
- Implements custom drop logic to clean up task-local on completion

#### Key Methods:
- `take_value()` (L383-386): Extract the stored value
- `poll()` (L393-415): Future implementation that maintains scope during polling
- Custom `PinnedDrop` (L330-342): Ensures proper cleanup on drop

### Error Types

#### `AccessError` (L444-461)
- Returned when task-local value is not set
- Implements standard error traits

#### `ScopeInnerErr` (L463-487)
- Internal error type for scope operations
- Handles borrow conflicts and thread-local access errors
- Provides panic methods for error reporting

## Key Patterns & Architecture

### RAII Guard Pattern (L183-207)
- `Guard` struct ensures proper cleanup of task-local values
- Automatically restores previous value on scope exit
- Uses `mem::swap` to efficiently exchange values

### Thread-Local Foundation
- Built on top of `std::thread_local!` storage
- Each task-local key maps to a thread-local `RefCell<Option<T>>`
- Leverages existing thread-local infrastructure for storage

### Async-Safe Design
- `TaskLocalFuture` ensures values persist across yield points
- Proper pinning prevents memory safety issues
- Scope maintained during async polling cycles

## Critical Invariants

1. **Borrowing Safety**: RefCell ensures single mutable access at any time
2. **Scope Isolation**: Values are properly isolated between different scopes
3. **Cleanup Guarantee**: RAII pattern ensures values are cleaned up even on panic
4. **Pin Safety**: PhantomPinned prevents unsafe moves of pinned futures

## Dependencies
- `pin_project_lite`: For safe pinning of TaskLocalFuture
- Standard library: RefCell, thread_local, Future traits
- Internal Tokio task system integration
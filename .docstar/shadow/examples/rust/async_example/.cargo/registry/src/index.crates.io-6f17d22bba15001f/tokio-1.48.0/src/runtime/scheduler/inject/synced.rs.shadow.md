# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject/synced.rs
@source-hash: c9c4cab69cfb824e
@generated: 2026-02-09T17:58:16Z

## Purpose
Internal synchronized task queue data structure for Tokio's runtime scheduler injection mechanism. Manages a linked list of tasks that can be safely shared across threads under external synchronization.

## Key Components

### Synced Struct (L8-17)
Core data structure representing the synchronized state of an injector queue:
- `is_closed` (L10): Boolean flag indicating if the queue accepts new tasks
- `head` (L13): Optional pointer to the first task in the linked list
- `tail` (L16): Optional pointer to the last task in the linked list

### Safety Implementations (L19-20)
Manual `Send` and `Sync` implementations allowing cross-thread usage. Safety depends on external synchronization by the containing injector.

### Core Operations

#### pop<T> Method (L23-36)
Removes and returns the first task from the queue:
- Returns `None` if queue is empty (L24)
- Updates head pointer to next task (L26)
- Clears tail if queue becomes empty (L28-30)
- Breaks task's queue linkage (L32)
- Safely converts raw task to typed `Notified<T>` (L35)

## Dependencies
- `crate::runtime::task`: Task types and raw task manipulation functions
- Relies on `RawTask` and `Notified<T>` from task module

## Architecture Notes
- Part of work-stealing scheduler's global injection queue
- Designed for use under external locking/synchronization
- Uses unsafe operations for performance-critical task queue manipulation
- Conditional compilation excludes from WASM targets and non-full feature builds

## Critical Invariants
- Head/tail consistency: if head is None, tail must also be None
- Task linkage: popped tasks must have their queue_next pointer cleared
- Memory safety: raw task conversion assumes valid Notified was originally pushed
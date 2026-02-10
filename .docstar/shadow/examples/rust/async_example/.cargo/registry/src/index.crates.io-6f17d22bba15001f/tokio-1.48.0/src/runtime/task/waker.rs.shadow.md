# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/waker.rs
@source-hash: 39fbfa7c33406aac
@generated: 2026-02-09T18:03:13Z

## Purpose
Implements waker functionality for Tokio's async task system, providing efficient reference-counted waking mechanisms that bridge between Rust's std::task::Waker interface and Tokio's internal task management.

## Key Components

### WakerRef<'a, S> (L9-12)
Lightweight waker reference that avoids unnecessary reference counting increments. Uses `ManuallyDrop<Waker>` to prevent automatic cleanup and `PhantomData` for lifetime and scheduler type safety.

### waker_ref<S>() (L16-34)
Factory function that creates `WakerRef` instances from task headers. Implements workaround for `Waker::will_wake` VTABLE comparison issue (rust-lang/rust#66281) by using a unified VTABLE approach. Returns borrowed waker wrapped in `ManuallyDrop` to prevent premature dropping.

### Deref Implementation (L36-42)
Provides transparent access to underlying `Waker` methods through `WakerRef`.

## VTABLE Implementation

### Waker Operations (L67-94)
- `clone_waker()` (L67-72): Increments task reference count and returns new RawWaker
- `drop_waker()` (L74-79): Decrements reference count via RawTask::drop_reference()  
- `wake_by_val()` (L81-86): Consumes waker and wakes task
- `wake_by_ref()` (L89-94): Wakes task without consuming waker

### WAKER_VTABLE (L96-97)
Static RawWakerVTable instance linking std::task operations to Tokio's task lifecycle management.

### raw_waker() (L99-102)
Constructs RawWaker from task header pointer using the unified VTABLE.

## Tracing Infrastructure (L44-65)
Conditional compilation macros providing task operation tracing:
- `cfg_trace!`: Full tracing with task IDs when tracing enabled
- `cfg_not_trace!`: No-op implementation for production builds

## Dependencies
- `crate::runtime::task::{Header, RawTask, Schedule}`: Core task abstractions
- `std::task::{RawWaker, RawWakerVTable, Waker}`: Standard library waker interface

## Architecture Notes
- Uses unified VTABLE to solve std::task::Waker comparison issues
- Manual memory management via `ManuallyDrop` prevents double-drops
- Reference counting integrated with Tokio's task lifecycle
- Tracing support for debugging async task wake patterns
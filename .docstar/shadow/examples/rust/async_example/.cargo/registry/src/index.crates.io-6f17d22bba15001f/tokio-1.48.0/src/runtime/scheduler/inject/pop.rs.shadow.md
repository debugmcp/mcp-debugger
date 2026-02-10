# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject/pop.rs
@source-hash: 335b42278217a302
@generated: 2026-02-09T17:58:17Z

## Primary Purpose
This file implements a specialized iterator for popping tasks from Tokio's global injection queue in the work-stealing scheduler. The `Pop` struct provides controlled iteration over queued tasks while maintaining length tracking.

## Key Components

### Pop Struct (L7-11)
- **Purpose**: Iterator wrapper for safely popping tasks from synchronized queue
- **Fields**:
  - `len`: Current number of items available to pop
  - `synced`: Mutable reference to the synchronized queue data structure
  - `_p`: PhantomData marker for generic type `T`
- **Generic Parameter**: `T: 'static` represents the task type being scheduled

### Constructor (L14-20)
- `new()`: Creates Pop iterator with initial length and synced queue reference
- Takes ownership of length count and borrows synced queue mutably

### Iterator Implementation (L23-43)
- **Item Type**: `task::Notified<T>` - represents a notified/ready-to-run task
- **next() (L26-38)**: 
  - Returns `None` when length reaches 0
  - Calls `synced.pop()` to extract task from queue
  - Decrements internal length counter
  - Includes debug assertion that pop succeeds when length > 0
- **size_hint() (L40-42)**: Returns exact size bounds using internal length

### ExactSizeIterator (L45-49)
- Implements precise length reporting via `len()` method
- Enables optimizations for collections that know their exact size

### Drop Implementation (L51-55)
- **Critical Behavior**: Ensures all remaining tasks are consumed when iterator is dropped
- Prevents task leakage by exhausting iterator via `by_ref()`

## Dependencies
- `super::Synced`: The synchronized queue data structure being wrapped
- `crate::runtime::task`: Task types, specifically `Notified<T>`
- `std::marker::PhantomData`: Zero-cost generic type marker

## Architectural Notes
- Part of Tokio's work-stealing scheduler injection queue mechanism
- Provides safe iteration abstraction over low-level synchronized queue operations
- Length tracking enables precise iterator bounds and prevents over-consumption
- Drop implementation ensures resource cleanup and prevents task abandonment
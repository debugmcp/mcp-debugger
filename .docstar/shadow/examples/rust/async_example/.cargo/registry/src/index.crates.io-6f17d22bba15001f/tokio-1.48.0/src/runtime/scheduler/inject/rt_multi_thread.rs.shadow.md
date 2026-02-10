# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/inject/rt_multi_thread.rs
@source-hash: 2b2715f7724cdaa2
@generated: 2026-02-09T17:58:17Z

## Multi-threaded Runtime Scheduler Inject Queue Implementation

This file implements the multi-threaded runtime-specific operations for Tokio's inject queue, which is used to distribute tasks across worker threads in the multi-threaded scheduler.

### Core Purpose
Provides batch task insertion operations for the shared inject queue in multi-threaded runtime contexts, with proper synchronization and cleanup mechanisms.

### Key Implementations

**Lock Trait for Synced (L8-14)**
- Implements `Lock<Synced>` for `&'a mut Synced` 
- Provides identity lock operation since mutable reference already guarantees exclusive access
- Returns self as the handle

**AsMut Trait for Synced (L16-20)**
- Standard conversion trait implementation
- Enables mutable access to Synced instances

**Shared<T> Batch Operations (L22-112)**
- `push_batch()` (L29-59): Main entry point for inserting multiple tasks atomically
  - Takes iterator of `task::Notified<T>` items
  - Links tasks together in a chain using `queue_next` pointers
  - Uses `for_each()` for compiler optimization with `std::iter::Chain`
  - Delegates to `push_batch_inner()` for actual insertion

- `push_batch_inner()` (L66-112): Core batch insertion logic
  - Handles queue closure scenarios by cleaning up orphaned tasks (L79-91)
  - Updates head/tail pointers atomically under lock (L95-103)
  - Maintains task count with release ordering for memory synchronization (L109-111)

### Safety Invariants
- Must be called with the same `Synced` instance from `Inject::new`
- Relies on `Notified` ownership for exclusive access to `queue_next` fields
- Queue length updates are synchronized through mutex protection
- Proper cleanup of tasks when queue is closed

### Dependencies
- `super::{Shared, Synced}` - Core inject queue types
- `crate::runtime::scheduler::Lock` - Synchronization trait
- `crate::runtime::task` - Task management types
- Uses atomic operations with `Release` ordering for memory synchronization

### Architecture Notes
- Optimized for batch operations to reduce lock contention
- Handles edge cases like empty iterators and closed queues gracefully
- Uses linked list structure for efficient task chaining
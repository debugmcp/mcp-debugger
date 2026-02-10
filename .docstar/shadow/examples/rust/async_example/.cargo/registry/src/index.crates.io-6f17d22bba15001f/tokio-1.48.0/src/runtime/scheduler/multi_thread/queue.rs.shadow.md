# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/queue.rs
@source-hash: e53e6fd84664d807
@generated: 2026-02-09T17:58:22Z

This file implements a lock-free work-stealing deque used by Tokio's multi-threaded scheduler for task queue management.

## Core Architecture

The queue uses a two-handle design:
- `Local<T>` (L29-31): Single-threaded producer handle for pushing/popping tasks
- `Steal<T>` (L34): Multi-threaded consumer handle for stealing tasks across threads

## Inner Structure (L36-57)

The `Inner<T>` struct contains the actual queue implementation:
- `head` (L50): Atomic packed value containing both real head and steal-in-progress marker
- `tail` (L53): Atomic tail pointer, updated only by producer
- `buffer` (L56): Fixed-size circular buffer of task slots

## Key Constants & Configuration

- `LOCAL_QUEUE_CAPACITY` (L63/L69): 256 tasks normally, 4 under loom testing
- `MASK` (L71): Bitmask for circular buffer indexing
- Platform-adaptive integer types (L15-26) for ABA resilience on different architectures

## Critical Operations

### Producer Operations (Local impl L107-391)
- `push_back_or_overflow()` (L192-227): Core push with overflow handling to injection queue
- `push_overflow()` (L257-349): Moves half the queue to overflow when full
- `pop()` (L352-390): LIFO pop with atomic head management

### Consumer Operations (Steal impl L393-560)  
- `steal_into()` (L408-459): Main work-stealing entry point
- `steal_into2()` (L463-559): Core stealing logic that transfers half of available tasks

## Concurrency Protocol

The queue uses a sophisticated atomic protocol:
- Head contains packed values: steal marker (MSB) and real head (LSB)
- When `steal == real`, no active stealing
- Stealers increment real head first, then update steal marker when complete
- Uses compare-and-swap loops for all atomic updates

## Memory Safety

- Uses `UnsafeCell<MaybeUninit<T>>` for uninitialized buffer slots
- Careful pointer arithmetic with proper safety comments
- Single writer (Local) / multiple reader (Steal) access pattern

## Utility Functions

- `unpack()`/`pack()` (L584-594): Convert between packed and separate head values  
- `len()` (L578-580): Calculate queue length from head/tail
- `make_fixed_size()` (L77-82): Convert dynamic array to fixed-size array

## Dependencies

- Heavy use of `loom` abstractions for testing lock-free code
- Integrates with Tokio's task system (`task::Notified<T>`)
- Uses `Overflow` trait for injection queue integration
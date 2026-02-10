# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/notify.rs
@source-hash: 2e37be68b37d6fd5
@generated: 2026-02-09T18:06:51Z

## Primary Purpose
Implements `Notify`, a single-permit synchronization primitive that allows tasks to wait for notification events. Provides both FIFO and LIFO notification strategies and supports both single and multi-waiter scenarios.

## Core Structure - Notify (L202-215)
The main synchronization primitive containing:
- `state`: AtomicUsize storing notification state (EMPTY/WAITING/NOTIFIED) plus notify_waiters call count
- `waiters`: Mutex-protected linked list of waiting tasks

### State Management Constants (L444-451)
- `EMPTY` (0): No waiters, no pending notifications
- `WAITING` (1): One or more tasks waiting
- `NOTIFIED` (2): Pending notification available

## Key Methods

### Construction (L473-513)
- `new()` (L483): Creates new Notify instance
- `const_new()` (L508): Const constructor for static instances

### Notification Creation (L565-623)
- `notified()` (L565): Returns `Notified<'_>` future tied to Notify lifetime
- `notified_owned()` (L613): Returns `OwnedNotified` with Arc ownership

### Notification Dispatch (L660-709)
- `notify_one()` (L660): Wakes first waiter (FIFO) or stores permit
- `notify_last()` (L673): Wakes last waiter (LIFO) or stores permit
- `notify_waiters()` (L743): Wakes all current waiters, no permit storage

## Future Types

### Notified<'a> (L384-396)
Borrowed future with state machine (Init/Waiting/Done):
- `enable()` (L1006): Registers for notifications without polling
- `poll_notified()` (L1028): Core polling logic with waker management

### OwnedNotified (L407-419)
Arc-owned version of Notified with identical interface but independent lifetime.

## Internal Components

### Waiter (L218-237)
Linked list node representing waiting task:
- `pointers`: Intrusive list pointers
- `waker`: UnsafeCell-wrapped task waker
- `notification`: Atomic notification state

### AtomicNotification (L274-310)
Type-safe wrapper around notification states:
- `store_release()` (L283): Atomically sets notification
- `load()` (L292): Reads notification state
- `clear()` (L307): Resets to none state

### NotifyWaitersList (L329-376)
RAII wrapper for safely managing waiter list during `notify_waiters()`:
- Ensures cleanup on drop to prevent dangling pointers
- Guards access to linked list during bulk notifications

## Synchronization Strategy

### Lock Ordering
1. Load state atomically
2. Acquire waiters mutex only when necessary
3. Reload state under lock for consistency

### Memory Ordering
Uses SeqCst for state transitions to ensure proper happens-before relationships between notification and waiting.

## Safety Invariants
- State transitions from WAITING only occur under lock
- Waiter removal requires exclusive list access
- UnsafeCell waker access protected by notification state
- Pin safety maintained for self-referential structures

## Dependencies
- `linked_list`: Intrusive linked list implementation
- `loom`: Concurrency testing abstractions  
- `WakeList`: Batch waker notification utility
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/broadcast.rs
@source-hash: d1392268f522b6e6
@generated: 2026-02-09T18:06:54Z

## Purpose
Multi-producer, multi-consumer broadcast channel implementation for Tokio. Provides a bounded queue where each sent value is cloned and delivered to all active receivers, with lagging detection and automatic message eviction.

## Key Types

### Core Channel Types
- `Sender<T>` (L165): Sending half that broadcasts values to all receivers. Cloneable for multiple producers.
- `WeakSender<T>` (L199): Non-owning sender that doesn't prevent channel closure. Must upgrade to `Sender` to send.
- `Receiver<T>` (L239): Receiving half that gets cloned values. Not thread-safe (single consumer per instance).

### Internal Data Structures
- `Shared<T>` (L341): Core data structure containing circular buffer, receiver count, and synchronization primitives
- `Slot<T>` (L377): Buffer entry with reference count (`rem`), position (`pos`), and optional value
- `Tail` (L362): Write cursor tracking next position, receiver count, closed state, and waiter queue
- `Waiter` (L397): Linked list node for async receivers waiting on empty channel

### Future Types
- `Recv<'a, T>` (L435): Future for async receive operations with embedded waiter
- `RecvGuard<'a, T>` (L430): RAII guard that decrements slot reference count on drop

### Error Types (L247-334)
- `SendError<T>`: Send failed due to no active receivers
- `RecvError`: Receive failed (channel closed or lagged)
- `TryRecvError`: Non-blocking receive failed (empty, closed, or lagged)

## Key Methods

### Channel Creation
- `channel<T>(capacity)` (L508): Creates sender-receiver pair with specified capacity
- `Sender::new(capacity)` (L526): Creates sender without initial receiver

### Sending
- `Sender::send(value)` (L631): Broadcasts value to all receivers, returns receiver count
- `Sender::subscribe()` (L692): Creates new receiver starting from current tail position

### Receiving
- `Receiver::recv()` (L1467): Async receive with lagging detection
- `Receiver::try_recv()` (L1511): Non-blocking receive
- `Receiver::blocking_recv()` (L1543): Blocking receive for sync contexts

### Channel Management
- `Sender::len()` (L746): Number of queued messages using binary search
- `Receiver::len()` (L1165): Messages pending for this receiver
- `Sender::receiver_count()` (L836): Active receiver count
- `Sender::closed()` (L889): Future that completes when all receivers drop

## Architecture Patterns

### Circular Buffer Design
Uses power-of-2 sized buffer with position masking for O(1) indexing. Each slot tracks remaining receivers and position to handle wraparound correctly.

### Reference Counting
Each slot maintains atomic reference count (`rem`) decremented by receivers. Value dropped when count reaches zero, enabling memory-efficient broadcasting.

### Lagging Detection
When receiver falls behind by more than buffer capacity, it's marked as lagged and repositioned to oldest available message. Prevents slow receivers from blocking the channel.

### Async Waiting
Uses intrusive linked list of `Waiter` nodes for efficient async notification. Waiters self-remove on drop to prevent use-after-free.

## Memory Ordering
- `SeqCst` for slot reference counts (critical for correctness)
- `AcqRel`/`Acquire`/`Release` for sender/receiver counts
- `Relaxed` for waiter queue operations under lock protection

## Critical Invariants
- Buffer size must be power of 2 for efficient masking
- Slot positions use wrapping arithmetic to handle overflow
- Lock ordering: tail lock before slot locks to prevent deadlock
- Waiter nodes must remain pinned while in linked list

## Dependencies
- `tokio::util::linked_list`: Intrusive linked list for waiter queue
- `tokio::util::WakeList`: Batch waker notification
- `tokio::loom`: Testing framework abstractions
- `tokio::task::coop`: Cooperative yielding support
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/bounded.rs
@source-hash: 2dab29e0058d570e
@generated: 2026-02-09T18:03:34Z

## Tokio MPSC Bounded Channel Implementation

**Primary Purpose**: Implements a bounded multi-producer single-consumer (MPSC) channel with backpressure for asynchronous communication in Tokio. Provides capacity-limited message passing with permit-based reservation system.

### Key Types and Structure

**Core Channel Types**:
- `Sender<T>` (L22-24): Main sender handle for bounded channel, wraps `chan::Tx<T, Semaphore>`
- `WeakSender<T>` (L56-58): Non-owning sender that doesn't prevent channel closure, holds `Arc<chan::Chan<T, Semaphore>>`  
- `Receiver<T>` (L106-109): Single receiver handle, wraps `chan::Rx<T, Semaphore>`
- `Semaphore` (L176-179): Internal capacity management with semaphore and bound tracking

**Permit System**:
- `Permit<'a, T>` (L67-69): Borrowed permit for guaranteed send capacity
- `OwnedPermit<T>` (L95-97): Owned permit that moves the sender, for `'static` lifetime requirements  
- `PermitIterator<'a, T>` (L78-81): Iterator over multiple permits for batch operations

### Channel Creation and Management

**Channel Factory** (L159-171):
- `channel<T>(buffer: usize)` creates sender-receiver pair
- Panics if buffer capacity is 0 or exceeds `Semaphore::MAX_PERMITS`
- Uses internal `Semaphore` wrapper for capacity tracking

### Sender Operations

**Message Sending**:
- `send()` (L816-824): Async send with backpressure, reserves then sends
- `try_send()` (L924-934): Non-blocking send, returns error if full/closed
- `send_timeout()` (L988-1005): Send with timeout, requires "time" feature
- `blocking_send()` (L1046-1048): Blocking send for sync contexts

**Capacity Reservation**:
- `reserve()` (L1116-1119): Async reserve single slot, returns `Permit`
- `reserve_many()` (L1177-1183): Async reserve multiple slots, returns `PermitIterator`
- `reserve_owned()` (L1265-1270): Async reserve returning `OwnedPermit`
- `try_reserve()` (L1327-1335): Non-blocking single reservation
- `try_reserve_many()` (L1405-1420): Non-blocking multi-reservation
- `try_reserve_owned()` (L1477-1487): Non-blocking owned reservation

**Status and Metadata**:
- `is_closed()` (L1068-1070): Check if receiver dropped or closed
- `closed()` (L862-864): Async wait for channel closure
- `capacity()` (L1538-1540): Current available permits
- `max_capacity()` (L1585-1587): Maximum buffer capacity
- `same_channel()` (L1501-1503): Compare sender instances

### Receiver Operations  

**Message Receiving**:
- `recv()` (L243-246): Async receive, returns `None` when closed
- `recv_many()` (L319-322): Async batch receive into Vec with limit
- `try_recv()` (L364-366): Non-blocking receive
- `blocking_recv()` (L424-426): Blocking receive for sync contexts
- `poll_recv()` (L650-652): Low-level polling interface
- `poll_recv_many()` (L722-729): Low-level batch polling

**Channel Control**:
- `close()` (L478-480): Close receiving half, allows draining buffered messages
- `is_closed()` (L504-506): Check closure status  
- `is_empty()` (L526-528): Check if no messages queued
- `len()` (L545-547): Current message count

**Capacity Tracking**:
- `capacity()` (L591-593): Current available capacity
- `max_capacity()` (L625-627): Maximum buffer capacity
- `sender_strong_count()` (L732-734): Count of strong sender handles
- `sender_weak_count()` (L736-738): Count of weak sender handles

### Permit Operations

**Permit Usage**:
- `Permit::send()` (L1692-1699): Consume permit to send message
- `OwnedPermit::send()` (L1816-1823): Send with owned permit, returns sender
- `OwnedPermit::release()` (L1855-1865): Release permit without sending

**PermitIterator** (L1729-1747):
- Implements `Iterator` yielding individual `Permit`s
- Provides `ExactSizeIterator` and `FusedIterator` traits
- Proper cleanup on drop releases unused permits

### WeakSender Semantics

**Upgrade Pattern** (L1636-1638):
- `WeakSender::upgrade()` attempts conversion to `Sender`
- Returns `None` if all strong senders dropped
- Enables observer pattern without keeping channel alive

### Architecture Patterns

**Semaphore-Based Backpressure**: Uses internal semaphore for capacity management, blocking senders when full
**Permit Reservation**: Two-phase send protocol (reserve → send) prevents message loss on cancellation  
**Weak Reference Support**: `WeakSender` enables observation without affecting channel lifetime
**Batch Operations**: `recv_many` and `reserve_many` optimize multi-message scenarios
**Cancel Safety**: Most async operations designed to be cancellation-safe

### Error Handling

Uses dedicated error types from `crate::sync::mpsc::error`:
- `SendError<T>`: Channel closed during send
- `TrySendError<T>`: Non-blocking send failures (full/closed)
- `SendTimeoutError<T>`: Timeout during send
- `TryRecvError`: Non-blocking receive failures (empty/disconnected)

### Feature Dependencies

- Core functionality always available
- `cfg_time!` block (L6-9): Timeout operations require "time" feature
- `#[cfg(feature = "sync")]`: Blocking operations require "sync" feature
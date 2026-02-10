# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/chan.rs
@source-hash: baf5475ebdf06a4e
@generated: 2026-02-09T18:03:24Z

This file implements the core channel types for Tokio's multi-producer, single-consumer (MPSC) message passing system. It provides the foundational channel structures that support both bounded and unbounded channels through a generic semaphore abstraction.

## Core Architecture

**Chan<T, S> (L52-75)**: The central channel structure shared between sender and receiver halves via Arc. Contains:
- `tx`: Lock-free list sender handle for pushing values
- `rx_waker`: Atomic waker for notifying receivers of new messages
- `notify_rx_closed`: Notifies senders when receiver is dropped
- `semaphore`: Generic capacity control (bounded/unbounded)
- `tx_count`: Tracks active sender handles for close detection
- `tx_weak_count`: Tracks weak sender references
- `rx_fields`: Receiver-only data protected by UnsafeCell

**RxFields<T> (L92-99)**: Receiver-exclusive data containing the list receiver handle and close state flag.

## Channel Endpoints

**Tx<T, S> (L19-21)**: Sender handle wrapping shared channel state. Key operations:
- `send()` (L180): Pushes value and wakes receiver
- `closed()` (L200): Async wait for channel closure
- Reference counting via Clone/Drop for proper cleanup
- `upgrade()` (L156): Converts weak reference to strong sender

**Rx<T, S> (L30-32)**: Receiver handle with semaphore constraint. Core methods:
- `recv()` (L289): Async receive with task cooperation and double-check pattern
- `recv_many()` (L346): Batch receive up to limit with efficient permit handling
- `try_recv()` (L428): Non-blocking receive with park/wake fallback for busy conditions
- `close()` (L246): Explicitly closes channel and notifies waiters

## Semaphore Abstraction

**Semaphore trait (L40-50)**: Abstracts capacity management for bounded/unbounded channels:
- `add_permit()`/`add_permits()`: Return capacity after message consumption
- `close()`/`is_closed()`: Channel termination control
- `is_idle()`: Checks if all permits available (empty channel)

**Implementations**:
- `bounded::Semaphore` (L570-590): Uses internal semaphore with fixed bound
- `unbounded::Semaphore` (L594-624): Uses AtomicUsize with bit manipulation (count in upper bits, close flag in LSB)

## Key Patterns

**Double-check receive pattern**: Both `recv()` and `recv_many()` use try_recv! macro that attempts message retrieval twice - before and after waker registration - to avoid race conditions.

**Task cooperation**: Receive methods integrate with Tokio's cooperative scheduling via `coop::poll_proceed()` and `made_progress()`.

**Memory safety**: UnsafeCell access is carefully controlled - rx_fields only accessed by receiver, with proper Drop cleanup draining remaining messages.

**Reference counting**: Tx implements Clone/Drop with atomic counters, enabling multiple senders with proper channel lifetime management.

The channel factory function `channel()` (L115) creates the shared Chan instance and returns paired Tx/Rx handles, establishing the MPSC relationship.
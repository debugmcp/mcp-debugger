# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/unbounded.rs
@source-hash: 038ec725b3ee672d
@generated: 2026-02-09T18:03:23Z

## Tokio Unbounded MPSC Channel Implementation

**Primary Purpose:** Implements unbounded multi-producer, single-consumer (MPSC) channel types and operations for Tokio's async runtime. Provides message passing without backpressure - unlimited buffering until memory exhaustion.

### Core Types

**UnboundedSender<T> (L11-13):**
- Main sending handle for unbounded channels
- Wraps `chan::Tx<T, Semaphore>` from internal channel implementation
- Cloneable for multi-producer scenarios
- Critical method: `send()` (L547-554) - non-blocking, always succeeds unless channel closed

**UnboundedReceiver<T> (L72-75):**
- Single receiving handle for unbounded channels
- Wraps `chan::Rx<T, Semaphore>` from internal channel implementation
- Key methods:
  - `recv()` (L167-171) - async receive with cancel safety
  - `try_recv()` (L286-288) - non-blocking receive
  - `poll_recv()` (L434-436) - low-level polling interface
  - `recv_many()` (L241-244) - batch receive operation

**WeakUnboundedSender<T> (L45-47):**
- Weak reference to sender that doesn't prevent channel closure
- Must be upgraded via `upgrade()` (L707-709) to send messages
- Implements proper reference counting with `Drop` trait (L697-701)

### Channel Creation

**unbounded_channel<T>() (L95-102):**
- Factory function creating (sender, receiver) pair
- Uses `Semaphore(AtomicUsize::new(0))` as capacity control mechanism
- Returns tuple of `(UnboundedSender<T>, UnboundedReceiver<T>)`

### Internal Mechanisms

**Semaphore (L105-106):**
- Zero-capacity semaphore wrapper around `AtomicUsize`
- Used as type parameter for underlying channel generic implementation
- Enables unbounded behavior in bounded channel infrastructure

**Reference Counting Logic:**
- `inc_num_messages()` (L556-585) - atomic increment with overflow protection
- Complex bit manipulation for tracking channel state and message count
- Uses compare-and-swap loop for lock-free operation
- Critical invariant: LSB indicates channel closure state

### Key Features

**Memory Safety:**
- Panic on overflow at `usize::MAX ^ 1` messages (L567-571)
- Process abort as last resort for unrecoverable state

**Async Integration:**
- Cancel-safe operations marked explicitly in documentation
- `poll_fn` wrapper pattern for async methods (L168-170, L242-243)
- Waker management for efficient async scheduling

**Blocking Variants:**
- `blocking_recv()` (L321-323) and `blocking_recv_many()` (L331-333)
- Conditional compilation with `#[cfg(feature = "sync")]`
- Uses `crate::future::block_on()` for sync contexts

### Dependencies

- `crate::sync::mpsc::chan` - Core channel implementation
- `crate::loom::sync` - Testing framework abstractions for concurrency
- `std::task::{Context, Poll}` - Async polling infrastructure
- `std::sync::atomic` - Lock-free atomic operations
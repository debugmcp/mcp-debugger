# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/
@generated: 2026-02-09T18:16:17Z

## Tokio MPSC Channel Implementation

This directory implements Tokio's multi-producer, single-consumer (MPSC) channel system, providing both bounded and unbounded asynchronous message passing primitives with lock-free performance and cooperative scheduling integration.

### Overall Architecture

The implementation follows a layered design with shared core infrastructure:

**Storage Layer (block.rs, list.rs)**: Lock-free linked list of fixed-size blocks for memory-efficient message storage. Each block contains 32 slots (64-bit) or 16 slots (32-bit) with atomic coordination between producers and consumer.

**Channel Core (chan.rs)**: Generic channel implementation abstracted over semaphore types, providing shared infrastructure for both bounded and unbounded variants through the `Chan<T, S>` structure.

**Public APIs (bounded.rs, unbounded.rs)**: Type-safe wrappers exposing distinct semantics:
- Bounded channels with backpressure and permit-based reservation
- Unbounded channels with unlimited buffering

**Error Handling (error.rs)**: Comprehensive error types for all failure modes (capacity limits, channel closure, timeouts).

### Key Components Integration

**Block Management**: The `block` module provides atomic block storage with lock-free operations. Blocks are organized in a linked list managed by the `list` module, which handles producer contention and consumer advancement.

**Semaphore Abstraction**: The `chan` module uses a generic semaphore trait to control capacity:
- Bounded: Uses actual semaphore with fixed permits
- Unbounded: Uses AtomicUsize with bit manipulation for unlimited capacity

**Reference Counting**: Both channel types support weak references (`WeakSender`/`WeakUnboundedSender`) that don't prevent channel closure, enabling observer patterns.

### Public API Surface

**Channel Creation**:
- `channel(buffer: usize)` → `(Sender<T>, Receiver<T>)` - bounded channel
- `unbounded_channel()` → `(UnboundedSender<T>, UnboundedReceiver<T>)` - unbounded channel

**Core Operations**:
- **Sending**: `send()`, `try_send()`, `blocking_send()` with timeout variants
- **Receiving**: `recv()`, `try_recv()`, `recv_many()`, `blocking_recv()` 
- **Capacity Management** (bounded only): `reserve()`, `reserve_many()` with permit system
- **Channel Control**: `close()`, `closed()`, capacity/length queries

**Advanced Features**:
- **Permit System** (bounded): Two-phase send protocol prevents message loss on cancellation
- **Batch Operations**: `recv_many()` and `reserve_many()` for efficient multi-message handling
- **Weak References**: Non-owning handles that must be upgraded before use

### Internal Data Flow

1. **Message Storage**: Values stored in lock-free linked blocks with atomic slot coordination
2. **Producer Coordination**: Multiple senders use atomic operations to claim slots and advance tail pointer
3. **Consumer Processing**: Single receiver advances through blocks, reclaiming empty blocks for reuse
4. **Memory Management**: Block recycling system minimizes allocations through reuse protocols
5. **Waker Management**: Integrated with Tokio's task system for efficient async scheduling

### Critical Patterns

**Lock-Free Design**: Extensive use of atomic operations with careful memory ordering (Acquire/Release/AcqRel) for performance and correctness.

**Cooperative Scheduling**: Integration with Tokio's cooperative scheduler via `coop::poll_proceed()` to prevent monopolizing the runtime.

**Cancel Safety**: Most async operations designed to be cancellation-safe, with explicit documentation of guarantees.

**Memory Safety**: Careful use of `UnsafeCell` and atomic coordination to prevent data races while maintaining performance.

**Feature Gating**: Blocking operations require "sync" feature, timeout operations require "time" feature.

### Error Handling Strategy

Structured error types distinguish between:
- **Capacity Issues**: `Full` vs `Closed` for different send failure modes
- **Receive States**: `Empty` vs `Disconnected` for receive failures  
- **Timeout Scenarios**: Dedicated timeout error types preserve original values
- **Value Recovery**: All error types preserve unsent/unreceived values for recovery

This implementation provides high-performance, feature-rich MPSC channels that form a critical component of Tokio's async ecosystem, supporting everything from simple message passing to complex coordination patterns with backpressure control.
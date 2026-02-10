# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/batch_semaphore.rs
@source-hash: d459de6baecdd869
@generated: 2026-02-09T18:07:00Z

## Batch Semaphore Implementation

This file implements an asynchronous counting semaphore optimized for batch permit acquisition in Tokio's synchronization primitives. The implementation uses an intrusive linked list of waiters to provide fair access to permits.

### Core Architecture

The semaphore uses a lock-free permit counter combined with a mutex-protected wait queue to balance performance and fairness. The design ensures that large permit requests won't be starved by smaller ones.

### Key Components

**Semaphore (L35-41)**: Main semaphore structure containing:
- `permits`: AtomicUsize storing available permits with closed flag in LSB
- `waiters`: Mutex protecting the wait queue and closed state
- Optional tracing span for observability

**Waitlist (L43-46)**: Protected state containing the waiter queue and closed flag

**Waiter (L79-112)**: Intrusive linked list node representing a waiting task:
- `state`: AtomicUsize tracking remaining permits needed
- `waker`: UnsafeCell<Option<Waker>> for task notification (unsafe, queue-lock protected)
- `pointers`: Linked list connectivity (unsafe, queue-lock protected)
- `_p`: PhantomPinned to prevent movement

**Acquire (L71-76)**: Future for permit acquisition containing the waiter node and acquisition state

### Core Operations

**Construction (L140-221)**: 
- `new()`: Creates semaphore with initial permits, validates MAX_PERMITS limit
- `const_new()`: Compile-time constructor for static allocation
- `new_closed()`/`const_new_closed()`: Creates pre-closed semaphores

**Synchronous Acquisition (L266-295)**: 
- `try_acquire()`: Lock-free CAS loop for immediate permit acquisition
- Returns TryAcquireError::Closed or NoPermits on failure

**Asynchronous Acquisition (L297-299, L575-618)**:
- `acquire()`: Returns Acquire future
- Future implements cooperative task scheduling and fair queuing
- Uses poll_acquire() for complex permit assignment logic

**Release Logic (L231-238, L306-370)**:
- `release()`: Delegates to add_permits_locked for batched permit distribution
- `add_permits_locked()`: Complex algorithm that:
  1. Assigns permits to waiters from back of queue (FIFO fairness)
  2. Wakes satisfied waiters in batches using WakeList
  3. Returns excess permits to atomic counter

**State Management (L242-264)**:
- `close()`: Sets closed bit and wakes all waiters
- `is_closed()`: Checks closed flag in permit counter
- `available_permits()`: Returns current permit count

### Critical Patterns

**Bit Manipulation**: Uses PERMIT_SHIFT (1) to reserve LSB for closed flag, MAX_PERMITS = usize::MAX >> 3 for future extensibility

**Lock Ordering**: Always acquires waitlist lock before CAS operations on permits counter to prevent race conditions

**Memory Safety**: Extensive use of unsafe code with documented safety invariants:
- Waiter waker/pointers only accessed under waitlist lock
- Pin projections maintain !Unpin invariant for intrusive list safety

**Fair Queuing**: FIFO waiter queue prevents starvation of large permit requests

**Cooperative Scheduling**: Integration with Tokio's task cooperation system for yield points

### Error Types

**TryAcquireError (L52-60)**: Closed or NoPermits variants
**AcquireError (L68-69)**: Only Closed (async acquire can always wait)

### Notable Implementation Details

- Semaphore implements Debug showing current permit count (L525-531)
- Acquire future is Sync despite UnsafeCell due to exclusive access patterns (L716)
- Drop impl for Acquire handles cleanup of partially-satisfied waiters (L686-708)
- Extensive conditional compilation for tracing support throughout
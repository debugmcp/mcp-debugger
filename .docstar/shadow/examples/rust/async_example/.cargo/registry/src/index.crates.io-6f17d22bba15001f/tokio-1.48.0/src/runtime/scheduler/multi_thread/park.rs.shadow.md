# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/park.rs
@source-hash: 6668ed92b0b3fbb0
@generated: 2026-02-09T17:58:23Z

## Multi-threaded Runtime Parking Mechanism

Implements thread parking/unparking for Tokio's multi-threaded runtime scheduler, combining driver-based and condition variable-based coordination.

### Core Components

**Parker (L16-18)**: Main parking handle that can park threads until woken. Contains shared `Inner` state via Arc for thread-safe access across clones.

**Unparker (L20-22)**: Wake-up handle that can unpark threads. Shares the same `Inner` state as its corresponding Parker.

**Inner (L24-36)**: Core parking state machine containing:
- `state`: AtomicUsize tracking park status (EMPTY/PARKED_CONDVAR/PARKED_DRIVER/NOTIFIED)  
- `mutex`/`condvar`: Condition variable coordination when driver unavailable
- `shared`: Arc to shared driver resources

**Shared (L44-47)**: Contains TryLock-wrapped Driver for exclusive access across multiple Parker instances.

### State Machine Constants (L38-41)
- `EMPTY (0)`: Thread not parked, no notifications
- `PARKED_CONDVAR (1)`: Thread parked on condition variable  
- `PARKED_DRIVER (2)`: Thread parked on I/O driver
- `NOTIFIED (3)`: Thread has pending unpark notification

### Key Methods

**Parker::park() (L69-71)**: Parks current thread indefinitely, delegating to `Inner::park()`.

**Parker::park_timeout() (L73-87)**: Parks with timeout (only zero duration supported). Falls back to loom counter increment if driver unavailable.

**Inner::park() (L115-131)**: Core parking logic - consumes pending notifications or attempts driver parking, falling back to condvar parking.

**Inner::park_driver() (L173-201)**: Parks on I/O driver after atomic state transition. Handles spurious wakeups and notifications.

**Inner::park_condvar() (L133-171)**: Parks on condition variable with proper synchronization. Loops to handle spurious wakeups.

**Inner::unpark() (L203-216)**: Wakes parked thread by swapping state to NOTIFIED. Routes to appropriate unpark mechanism based on current state.

### Architecture Patterns

- **Lock-free fast path**: Uses compare-exchange operations to avoid parking when notifications pending
- **Fallback hierarchy**: Prefers driver parking over condvar parking for better I/O integration  
- **Memory ordering**: Sequential consistency (SeqCst) ensures proper synchronization across threads
- **Shared driver model**: TryLock prevents multiple threads from accessing driver simultaneously

### Dependencies

- `crate::runtime::driver`: I/O/timer driver integration
- `crate::loom::sync`: Loom-compatible synchronization primitives for testing
- `crate::util::TryLock`: Non-blocking mutual exclusion

### Critical Invariants

- State transitions must be atomic to prevent race conditions
- Driver access is mutually exclusive via TryLock
- Memory barriers ensure notification visibility across threads
- Clone creates new parking state but shares driver resources
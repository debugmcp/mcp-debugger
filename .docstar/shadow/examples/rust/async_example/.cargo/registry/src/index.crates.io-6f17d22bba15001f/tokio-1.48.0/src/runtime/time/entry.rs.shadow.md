# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/entry.rs
@source-hash: 1dcdf006b7c47799
@generated: 2026-02-09T18:03:24Z

This module implements the core timer state machinery for Tokio's intrusive timer system, containing complex concurrent data structures with careful memory ordering semantics.

## Primary Components

### StateCell (L91-278)
Core atomic state container managing timer lifecycle through a single u64 state field:
- `state: AtomicU64` - holds expiration timestamp or special values (`STATE_DEREGISTERED`, `STATE_PENDING_FIRE`)
- `result: UnsafeCell<TimerResult>` - outcome when timer fires (unsafe access controlled by state)
- `waker: AtomicWaker` - registered task waker

Key methods:
- `poll()` (L142-149) - registers waker and checks completion state
- `mark_pending()` (L171-200) - atomically transitions to pending state if not expired
- `fire()` (L211-231) - sets result and transitions to deregistered state
- `extend_expiration()` (L252-269) - optimistic lock-free timer extension

### TimerEntry (L287-627) 
User-facing pinned timer structure:
- `driver: scheduler::Handle` - runtime reference for cleanup ordering
- `inner: Option<TimerShared>` - lazily initialized shared state
- `deadline: Instant` - target expiration time
- `registered: bool` - tracks registration status

Core operations:
- `reset()` (L571-596) - updates deadline and attempts lock-free extension
- `poll_elapsed()` (L598-617) - main polling interface with lazy registration
- `cancel()` (L540-569) - cleanup with proper driver synchronization
- `is_elapsed()` (L509-537) - checks completion status via registration state

### TimerShared (L336-456)
Intrusive linked-list node shared between entry and driver:
- `pointers: linked_list::Pointers<TimerShared>` - intrusive list linkage
- `registered_when: AtomicU64` - cached registration timestamp for wheel location
- `state: StateCell` - actual timer state
- Implements `linked_list::Link` trait (L458-476)

### TimerHandle (L326-687)
Raw pointer wrapper for driver-side timer access:
- `inner: NonNull<TimerShared>` - unsafe reference to shared state
- All operations are unsafe and require driver lock
- Key methods: `mark_pending()` (L659-671), `fire()` (L684-686)

## Architecture & Concurrency

**Access Control**: Timer state accessed only via:
1. Mutable reference to `TimerEntry` 
2. Held driver lock (provides acq/rel semantics)

**Lazy Registration**: Timers use optimistic lock-free rescheduling - state field updated immediately, driver observes changes during wheel traversal and reschedules accordingly.

**State Machine**: 
- Normal timestamp values (< `STATE_MIN_VALUE`)
- `STATE_PENDING_FIRE` - queued for firing
- `STATE_DEREGISTERED` - completed/cancelled

**Memory Ordering**: Careful use of relaxed/acquire/release ordering with driver lock providing synchronization barriers.

## Key Constants
- `STATE_DEREGISTERED: u64::MAX` (L72) - terminal state marker  
- `STATE_PENDING_FIRE` (L73) - queued for firing state
- `MAX_SAFE_MILLIS_DURATION` (L78) - largest safe tick value
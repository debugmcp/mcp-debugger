# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/word_lock.rs
@source-hash: 57133a9da052d8e8
@generated: 2026-02-09T18:11:44Z

## Purpose
Low-level word-sized lock implementation that manages its own queue of waiting threads. This is a foundational synchronization primitive for parking_lot that cannot use parking_lot itself, avoiding circular dependencies.

## Key Components

**WordLock (L76-287)** - Main synchronization primitive
- `state: AtomicUsize` (L77) - Encodes lock state, queue lock, and queue head pointer in a single word
- `new()` (L82-86) - Creates unlocked WordLock
- `lock()` (L89-98) - Fast path uses compare_exchange_weak, falls back to lock_slow()
- `unlock()` (L102-108) - Fast path checks queue state, falls back to unlock_slow() 
- `lock_slow()` (L111-175) - Handles contention: spins briefly, then parks thread in queue
- `unlock_slow()` (L178-286) - Wakes up queued threads, manages queue processing

**ThreadData (L16-47)** - Per-thread parking state
- `parker: ThreadParker` (L17) - Platform-specific thread parking mechanism
- `queue_tail`, `prev`, `next` (L31-33) - Intrusive doubly-linked list pointers
- Split queue design: unprocessed nodes (only next set) and processed nodes (prev set)

**State Management**
- `LOCKED_BIT: 1` (L70) - Lock ownership flag
- `QUEUE_LOCKED_BIT: 2` (L71) - Queue modification lock
- `QUEUE_MASK: !3` (L72) - Extracts queue head pointer from state
- `LockState` trait (L300-327) - Provides bit manipulation helpers for usize state

## Key Functions

**with_thread_data() (L51-68)** - Thread-local ThreadData access
- Uses TLS cache if ThreadParker construction is expensive
- Falls back to stack allocation for cheap ThreadParker implementations

**fence_acquire() (L292-298)** - Memory ordering helper
- Uses acquire load under ThreadSanitizer to avoid false positives
- Uses acquire fence otherwise

## Architecture Patterns

**Lock-free Queue Addition**: New threads can be added to queue head without locks using compare_exchange on state word.

**Two-phase Queue Processing**: Queue nodes start unprocessed (only next pointer), then get processed under queue lock (prev pointers filled in).

**Embedded Queue Pointers**: Uses pointer alignment requirements to pack queue head into state word alongside lock bits.

**Optimistic Spinning**: Attempts brief spinning before parking to handle short critical sections efficiently.

## Critical Invariants

- ThreadData alignment must exceed QUEUE_MASK bits for pointer packing
- Queue lock must be held when setting prev pointers or modifying queue_tail
- unlock() must not be called on unlocked WordLock (undefined behavior)
- Queue processing maintains bidirectional linking consistency
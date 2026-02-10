# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/lock_api-0.4.14/src/remutex.rs
@source-hash: a0cc36a3ac9ba2a3
@generated: 2026-02-09T18:11:48Z

## Purpose
Implements reentrant (recursive) mutexes that allow the same thread to acquire the lock multiple times. Built as a generic wrapper around any `RawMutex` implementation, adding reentrancy capability through thread ID tracking and lock counting.

## Key Components

### GetThreadId Trait (L45-55)
Safety-critical trait for obtaining unique thread identifiers. Implementations must ensure no two active threads share the same ID, though deceased thread IDs can be reused.

### RawReentrantMutex<R, G> (L64-203)
Core reentrant mutex implementation wrapping any `RawMutex`:
- `owner: AtomicUsize` - Current owning thread ID (0 = unlocked)
- `lock_count: Cell<usize>` - Nesting level for current owner
- `mutex: R` - Underlying raw mutex
- `get_thread_id: G` - Thread ID provider

Key methods:
- `lock_internal()` (L85-103) - Central locking logic handling both first acquisition and reentrant cases
- `lock()` (L107-112) - Blocking lock acquisition
- `try_lock()` (L117-119) - Non-blocking lock attempt
- `unlock()` (L128-135) - Decrements count, releases underlying mutex only when reaching zero

Additional capabilities for `RawMutexFair`:
- `unlock_fair()` (L160-167) - Fair unlock protocol
- `bump()` (L179-188) - Temporarily yield to waiting threads

Timed operations for `RawMutexTimed`:
- `try_lock_until()/try_lock_for()` (L194-202) - Timeout-based locking

### ReentrantMutex<R, G, T> (L216-541)
High-level reentrant mutex with RAII guards:
- Wraps `RawReentrantMutex` with `UnsafeCell<T>` for data storage
- `new()` (L233-243) - Standard constructor
- `from_raw()` (L256-266) - Constructor from existing components
- `lock()` (L310-314) - Returns `ReentrantMutexGuard`
- `try_lock()` (L325-332) - Non-blocking variant
- Arc-based operations (L415-449) - Support for `Arc<Self>` with `'static` guards

### Guard Types

#### ReentrantMutexGuard (L618-839)
Standard RAII guard with lifetime tied to mutex:
- Provides `Deref` access to protected data
- `map()` (L643-655) - Transform guard to point to subfield
- `unlocked()` (L724-734) - Temporarily release lock for function execution
- `unlock_fair()` (L754-760) - Fair unlock for `RawMutexFair`

#### ArcReentrantMutexGuard (L849-961)
Arc-based guard with `'static` lifetime (requires `arc_lock` feature):
- `into_arc()` (L863-870) - Consume guard and return Arc
- Similar unlocking and yielding operations as standard guard

#### MappedReentrantMutexGuard (L972-1139)
Guard pointing to mapped subfield of protected data:
- Cannot be temporarily unlocked (soundness restriction)
- Supports further mapping operations
- Only provides immutable access to data

## Architectural Patterns

### Thread Safety Model
- Uses `AtomicUsize` for lock owner tracking with `Ordering::Relaxed`
- `Cell<usize>` for lock count (single-threaded access guaranteed by outer mutex)
- Guards are `!Send` via `GuardNoSend` marker to prevent cross-thread usage

### Reentrancy Mechanism
1. Check if current thread already owns mutex (`owner.load()`)
2. If yes: increment `lock_count`, skip underlying mutex
3. If no: acquire underlying mutex, set owner, set count to 1
4. On unlock: decrement count, release underlying mutex only at count 0

### Feature Gating
- `arc_lock`: Enables Arc-based guards and operations
- `serde`: Serialization support (serializes protected data while locked)
- `owning_ref`: `StableAddress` implementations for guards

## Critical Invariants
- Lock count overflow protection with panic (L88-93)
- Guards always hold the lock when created
- Unlock operations must only be called by lock holder
- Thread ID must be non-zero and unique per active thread
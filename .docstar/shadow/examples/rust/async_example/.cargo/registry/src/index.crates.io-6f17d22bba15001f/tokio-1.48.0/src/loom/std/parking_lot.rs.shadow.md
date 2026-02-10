# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/parking_lot.rs
@source-hash: aeac33379b7d0b4a
@generated: 2026-02-09T18:02:56Z

## Tokio Loom Parking Lot Adapter

**Purpose**: Provides wrapper types around `parking_lot` synchronization primitives to match `std::sync` API while preventing parking_lot's `send_guard` feature from affecting Tokio's Send trait implementations.

### Core Architecture

All wrapper types use a `PhantomData<std::sync::EquivalentType>` as the first field (L22, L25, L28, L31, L37, L43) to control Send/Sync bounds independently of parking_lot's configuration. The second field contains the actual parking_lot primitive.

### Key Types

**Mutex<T>** (L22):
- `new(t: T)` (L50-52): Creates new mutex
- `const_new(t: T)` (L56-58): Const constructor (non-loom builds only)  
- `lock()` (L61-63): Blocking lock returning wrapped guard
- `try_lock()` (L66-70): Non-blocking lock attempt
- `get_mut()` (L73-75): Mutable reference when exclusively owned

**MutexGuard<'a, T>** (L31-34):
- Implements `Deref` (L81-86) and `DerefMut` (L88-92) for transparent access
- Implements `Display` (L179-183) for formatted output

**RwLock<T>** (L25):
- `new(t: T)` (L95-97): Creates new reader-writer lock
- `read()` (L99-101): Acquires read lock
- `try_read()` (L103-107): Non-blocking read lock attempt
- `write()` (L109-111): Acquires write lock  
- `try_write()` (L113-117): Non-blocking write lock attempt

**RwLockReadGuard<'a, T>** (L37-40) and **RwLockWriteGuard<'a, T>** (L43-46):
- Both implement `Deref` (L120-125, L127-132) for read access
- Write guard additionally implements `DerefMut` (L134-138)
- Both implement `Display` (L185-189, L191-195)

**Condvar** (L28):
- `new()` (L142-144): Creates new condition variable
- `notify_one()` (L147-149): Wakes one waiting thread
- `notify_all()` (L152-154): Wakes all waiting threads
- `wait()` (L157-163): Blocks until notification, returns `LockResult`
- `wait_timeout()` (L166-173): Blocks with timeout, returns result tuple

### Dependencies
- `parking_lot` crate for actual synchronization primitives
- `std::sync` for API compatibility types (`LockResult`, `TryLockError`)
- `std::time::Duration` for timeout operations

### Key Patterns
- Consistent PhantomData wrapping pattern for Send/Sync control
- Delegation to inner parking_lot types while maintaining std::sync API surface
- All methods marked `pub(crate)` for internal Tokio use only
- Guards maintain lifetime relationships through wrapper delegation
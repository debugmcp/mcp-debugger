# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/src/raw_rwlock.rs
@source-hash: bdbb06e1433ea2bc
@generated: 2026-02-09T18:11:47Z

## RawRwLock Implementation

A high-performance reader-writer lock implementation based on Boost's upgrade_mutex design using atomic operations and parking lot core primitives.

### Core Structure

**RawRwLock (L55-57)**: Main lock structure containing a single `AtomicUsize` state field that encodes reader count, writer status, and parking bits.

### State Encoding

The lock state uses bit flags in a single atomic word (L34-47):
- `PARKED_BIT` (0b0001): Threads waiting in main queue
- `WRITER_PARKED_BIT` (0b0010): Writer waiting for readers to exit
- `UPGRADABLE_BIT` (0b0100): Upgradable reader lock held
- `WRITER_BIT` (0b1000): Exclusive writer lock held or pending
- `READERS_MASK` (!0b1111): Upper bits count active readers
- `ONE_READER` (0b10000): Increment unit for reader count

### Lock Type Tokens

Park tokens identify waiting thread types (L49-52):
- `TOKEN_SHARED`: Regular reader lock
- `TOKEN_EXCLUSIVE`: Writer lock  
- `TOKEN_UPGRADABLE`: Upgradable reader lock

### Trait Implementations

**RawRwLock (L59-152)**: Basic reader-writer lock operations with fast-path optimizations and slow-path parking.

**RawRwLockFair (L154-187)**: Fair unlock variants that prevent starvation by handing locks directly to waiting threads.

**RawRwLockDowngrade (L189-201)**: Downgrade exclusive locks to shared locks, waking parked readers.

**RawRwLockTimed (L203-266)**: Timeout-based lock acquisition with deadline support.

**RawRwLockRecursive (L268-290)**: Recursive shared lock acquisition allowing same-thread re-entry.

**RawRwLockUpgrade (L320-394)**: Upgradable lock support - can be upgraded to exclusive writer.

**Additional upgrade traits (L396-504)**: Fair upgradable operations, downgrade variants, and timed upgrade operations.

### Key Methods

**Fast Path Operations (L508-536, L571-587)**: Optimized lock acquisition using compare-and-swap operations with hardware lock elision support.

**Slow Path Operations (L539-568, L590-610)**: Retry loops for contended cases with overflow checking.

**Exclusive Lock Acquisition (L613-646)**: Two-phase process: acquire WRITER_BIT, then wait for readers to exit.

**Lock Release (L649-674, L725-742, L784-850)**: Wake parked threads with fairness considerations and state transitions.

**Upgrade Operations (L853-877)**: Convert upgradable to exclusive lock, handling timeout and contention.

**Thread Parking (L940-974, L978-1067, L1071-1145)**: Core parking logic using dual wait queues at `addr` and `addr+1` for different lock types.

### Architecture Features

- **Dual Wait Queues**: Uses two parking addresses to separate regular waiters from writers waiting for readers
- **Fair Scheduling**: Alternates between read and write phases to prevent starvation
- **Hardware Lock Elision**: Uses TSX when available for reduced contention on empty locks
- **Overflow Protection**: Checks reader count overflow and panics appropriately
- **Deadlock Detection**: Integrates with parking_lot's deadlock detection system

### Dependencies

- `parking_lot_core`: Core parking/unparking primitives
- `lock_api`: Standard lock trait definitions
- `crate::elision`: Hardware lock elision support
- `crate::raw_mutex`: Token constants for handoff operations
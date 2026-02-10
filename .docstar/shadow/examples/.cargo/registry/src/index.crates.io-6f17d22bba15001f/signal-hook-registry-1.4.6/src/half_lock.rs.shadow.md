# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/signal-hook-registry-1.4.6/src/half_lock.rs
@source-hash: 548fc2e283ef638a
@generated: 2026-02-09T18:11:50Z

## Purpose
Custom lock-free data structure optimized for signal handler safety, implementing a dual-generation read-write synchronization mechanism that avoids standard mutexes in signal contexts.

## Core Architecture
The `HalfLock<T>` (L98-109) implements a specialized concurrent data structure using:
- Atomic pointer to heap-allocated data (`AtomicPtr<T>`)
- Generation counter to alternate between two lock slots
- Dual lock counters array `[AtomicUsize; 2]` for read tracking
- Writer mutex for exclusive write access

## Key Components

### ReadGuard (L47-64)
RAII guard for readers that:
- Holds reference to data and lock counter
- Automatically decrements lock counter on drop (L62)
- Provides `Deref` access to protected data

### WriteGuard (L66-96)  
RAII guard for writers that:
- Holds mutex guard to prevent concurrent writers
- Provides `store()` method (L73-87) to atomically swap data
- Waits for all readers to finish before dropping old data

### HalfLock Implementation (L111-217)

**Constructor** `new()` (L112-123):
- Allocates data on heap via `Box::into_raw()`
- Initializes generation counter to 0
- Sets up dual lock slots

**Reader Path** `read()` (L125-157):
- Loads current generation to select lock slot (L129-130)
- Increments reader count with overflow protection (L132-146)
- Returns `ReadGuard` with data reference

**Writer Path** `write()` (L194-216):
- Acquires exclusive writer mutex
- Returns `WriteGuard` for data modification

**Write Barrier** `write_barrier()` (L165-192):
- Implements spin-wait mechanism for reader drainage
- Switches generation to alternate lock slot (L173)
- Uses cooperative yielding every 16 iterations (L181-182)

## Synchronization Strategy
Uses generation-based approach where:
1. Readers use current generation's lock slot
2. Writers switch generation, forcing new readers to different slot  
3. Writer spins until both slots drain to zero
4. Old data safely dropped after barrier

## Memory Safety
- All data stored as heap-allocated `Box<T>` converted to raw pointers
- Atomic pointer swaps ensure memory ordering
- Conservative SeqCst ordering throughout (noted as performance non-critical)

## Constants
- `YIELD_EVERY: 16` - Cooperative yielding frequency in spin loop
- `MAX_GUARDS` - Overflow protection limit for reader count
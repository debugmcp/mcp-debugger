# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/parking_lot.rs
@source-hash: ead11d575a1930c2
@generated: 2026-02-09T18:11:52Z

## Core Parking Lot Implementation

This file implements the core parking/unparking mechanism for synchronization primitives, providing low-level thread blocking and wakeup operations.

### Architecture Overview

The system uses a hash table with chained buckets to organize parked threads by key (typically memory address). Each bucket contains a queue of waiting threads protected by a word lock.

**Key Components:**

- **HashTable (L57-86)**: Dynamically resizable hash table with power-of-2 sizing and 3x load factor
- **Bucket (L89-112)**: 64-byte aligned bucket containing mutex, thread queue, and fairness timeout
- **ThreadData (L151-193)**: Per-thread state including parker, key, queue linkage, and tokens
- **FairTimeout (L114-149)**: PRNG-based fairness mechanism triggering every ~0.5ms

### Threading and Memory Management

- **NUM_THREADS (L43)**: Global counter tracking live ThreadData objects
- **HASHTABLE (L51)**: Atomic pointer to current hash table, never freed once published
- **with_thread_data() (L196-208)**: Thread-local ThreadData access with fallback to stack allocation
- **grow_hashtable() (L264-314)**: Atomic table growth with full bucket locking during rehash

### Hash Function and Bucket Locking

- **hash() (L344-353)**: Fibonacci hashing for 32/64-bit architectures
- **lock_bucket() (L358-378)**: Retry loop handling concurrent table growth
- **lock_bucket_checked() (L384-408)**: Validates key hasn't changed due to requeuing
- **lock_bucket_pair() (L416-454)**: Deadlock-free two-bucket locking with ordered acquisition

### Core Parking Operations

**park() (L591-706)**: Primary blocking operation
- Validates condition while bucket locked
- Appends thread to queue and releases lock
- Calls pre-sleep callback
- Blocks until unparked or timeout
- Handles timeout by removing self from queue

**unpark_one() (L732-795)**: Wake single thread
- Finds first matching thread in bucket
- Removes from queue and checks for remaining threads
- Uses fairness timeout to set be_fair flag
- Unlocks bucket before system unpark call

**unpark_all() (L813-858)**: Wake all matching threads
- Collects all threads with matching key
- Batch unlocking after bucket unlock for performance

### Advanced Operations

**unpark_requeue() (L888-991)**: Conditional wake-and-move operation
- Locks both source and destination buckets
- Supports multiple operation modes via RequeueOp enum
- Used for condition variable broadcast implementations

**unpark_filter() (L1020-1093)**: Selective unparking with predicate
- Applies filter function to each thread's ParkToken
- Supports early termination via FilterOp::Stop

### Platform Abstractions

**TimeoutInstant (L19-41)**: Cross-platform time handling
- No-op implementation for WASM targets that lack std::time::Instant
- Standard Instant wrapper for other platforms

### Deadlock Detection (L1095-1427)

Optional feature providing cycle detection in wait graphs:
- **DeadlockData (L180-203)**: Per-thread resource tracking
- **check_deadlock() (L1244-1254)**: Two-phase detection (fast + slow)
- **graph_cycles() (L1400-1426)**: Petgraph-based cycle detection

### Fairness and Performance

- **FairTimeout::should_timeout() (L130-140)**: Randomized fairness triggering
- **LOAD_FACTOR = 3 (L55)**: Hash table sizing for reasonable collision rates
- Batch operations minimize lock hold time
- Memory ordering optimized for common uncontended case

### Safety Invariants

- Hash table pointer always valid once non-null, never freed
- Bucket locks must be held when manipulating queues
- ThreadData valid while thread parked in any queue
- Two-bucket operations use consistent ordering to prevent deadlock
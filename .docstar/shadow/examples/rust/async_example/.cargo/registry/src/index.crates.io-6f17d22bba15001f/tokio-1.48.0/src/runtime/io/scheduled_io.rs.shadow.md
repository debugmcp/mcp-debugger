# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/io/scheduled_io.rs
@source-hash: e76d33657c66cd86
@generated: 2026-02-09T18:03:17Z

## Primary Purpose

Core I/O readiness management for Tokio's async I/O system. Provides cache-aligned data structures for tracking I/O readiness state and coordinating task wakers in the I/O driver resource slab.

## Key Components

### ScheduledIo (L101-108)
Main resource entry stored in I/O driver slab. Cache-aligned per architecture (L39-100) to avoid false sharing:
- `linked_list_pointers`: Intrusive list management for driver cleanup
- `readiness`: Packed atomic state (shutdown bit + driver tick + readiness bits) (L105)
- `waiters`: Mutex-protected waiter management (L107)

**Critical State Packing (L164-174):**
```
| shutdown | driver tick | readiness |
|    1     |     15      |    16     |
```

### Waiters (L112-122) 
Waiter coordination structure:
- `list`: Linked list of general waiters (L115)
- `reader`/`writer`: Dedicated slots for AsyncRead/AsyncWrite polling (L118-121)

### Waiter (L124-138)
Individual task waiter with intrusive list support:
- `pointers`: Linked list integration (L126)
- `waker`: Task waker for notification (L129)
- `interest`: I/O interest mask (L132)
- `is_ready`: Notification flag (L134)

### Readiness Future (L148-156)
Async readiness polling with state machine:
- `scheduled_io`: Reference to parent resource (L150)
- `state`: Init/Waiting/Done progression (L152)
- `waiter`: Stack-allocated waiter entry (L155)

## Key Methods

### ScheduledIo Implementation

**token() (L189-191)**: Converts memory address to mio::Token for driver registration

**shutdown() (L195-199)**: Forces permanent shutdown state, wakes all waiters with Ready::ALL

**set_readiness() (L209-226)**: Atomic readiness updates with tick validation. Prevents stale event clearing through tick comparison (L219)

**wake() (L238-288)**: Efficient batch waker notification:
1. Collects wakers into stack array while holding lock
2. Releases lock periodically to prevent deadlock (L276-282)
3. Drains filtered waiters matching ready state (L258)

**poll_readiness() (L305-357)**: Synchronous readiness polling for AsyncRead/AsyncWrite:
- Uses dedicated reader/writer slots in waiters
- Double-checked locking pattern (L332-349)
- Immediate return for shutdown state (L335-340)

**readiness() (L384-386)**: Async readiness polling entry point

**clear_readiness() (L359-364)**: Consumes readiness state except closed states (final states)

### Readiness Future Implementation

**poll() (L429-565)**: Complex state machine with three phases:
1. **Init (L446-506)**: Optimistic check, then locked verification, waiter insertion
2. **Waiting (L508-535)**: Waker updates, readiness checking
3. **Done (L537-561)**: Final readiness extraction

**Drop (L568-578)**: Safe waiter removal from linked list

## Architecture Patterns

**Cache Alignment Strategy**: Platform-specific alignment (128B for x86_64/aarch64, 256B for s390x, etc.) to prevent false sharing in high-contention scenarios

**Double-Checked Locking**: Readiness checks before and after lock acquisition to minimize contention

**Intrusive Data Structures**: Zero-allocation linked list management for waiters

**Atomic State Packing**: Efficient bit-packing for readiness, tick, and shutdown state in single atomic

**Batch Waking**: Collects multiple wakers before lock release to prevent deadlock while maintaining performance

## Safety Invariants

- Waiter pointers remain valid while in linked list
- UnsafeCell access requires appropriate synchronization
- Tick-based stale event prevention
- PhantomPinned ensures waiter address stability
- Lock ordering: always acquire waiters lock before waking
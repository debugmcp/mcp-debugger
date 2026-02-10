# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/list.rs
@source-hash: 26c1452a37390b0c
@generated: 2026-02-09T18:03:25Z

## Lock-Free MPSC List Implementation

This module implements a concurrent, lock-free FIFO list for Tokio's multi-producer, single-consumer (MPSC) channel. It provides lock-free message passing using atomic operations and a linked list of blocks.

### Core Components

**Tx<T> (L12-19)** - Transmit handle for pushing values
- `block_tail: AtomicPtr<Block<T>>` - Points to current tail block in linked list
- `tail_position: AtomicUsize` - Next slot position to write to (combines block + offset)

**Rx<T> (L22-31)** - Receive handle for popping values  
- `head: NonNull<Block<T>>` - Current block being read from
- `index: usize` - Next slot index to read
- `free_head: NonNull<Block<T>>` - Head of blocks pending deallocation

**TryPopResult<T> (L34-43)** - Return type distinguishing pop failure modes
- Ok(T), Empty, Closed, Busy (value being written)

### Key Operations

**channel<T>() (L45-64)** - Creates initial shared block and returns (Tx, Rx) pair

**Tx::push() (L68-80)** - Lock-free value insertion
1. Atomically claims slot with `fetch_add(1, Acquire)` 
2. Finds target block via `find_block()`
3. Writes value to block slot

**Tx::close() (L86-94)** - Marks channel closed by claiming slot and setting TX_CLOSED flag

**Tx::find_block() (L96-179)** - Core block traversal algorithm
- Calculates target block from slot index using `block::start_index()`
- Walks linked list to find block containing target slot
- Opportunistically advances `block_tail` pointer to reduce contention
- May grow list by allocating new blocks via `block.grow()`

**Rx::pop() (L261-280)** - Single-consumer value retrieval
- Advances head pointer if needed via `try_advancing_head()`
- Reclaims processed blocks via `reclaim_blocks()`
- Returns `block::Read<T>` (Value or Closed)

**Rx::try_pop() (L290-300)** - Non-blocking pop with detailed failure reporting
- Uses tail position comparison to distinguish Empty vs Busy states

### Memory Management

**Tx::reclaim_block() (L181-220)** - Block recycling mechanism
- Attempts to reuse blocks by inserting at tail (up to 3 attempts)
- Falls back to deallocation if reuse fails

**Rx::reclaim_blocks() (L332-366)** - Batch block reclamation
- Processes blocks between `free_head` and `head` 
- Validates blocks are safe to reclaim via `observed_tail_position()`
- Pushes reclaimed blocks back to sender via `tx.reclaim_block()`

### Critical Invariants

- Single consumer: only one thread may call Rx methods
- Block ordering: blocks maintain index-based ordering in linked list  
- Memory ordering: Acquire/Release semantics coordinate between producers/consumer
- Block lifecycle: blocks transition through allocated → written → read → reclaimed states

### Dependencies

- `crate::sync::mpsc::block` - Block storage and operations
- `crate::loom::sync::atomic` - Atomic primitives (may be mocked for testing)
- Atomic orderings: Acquire, Release, AcqRel, Relaxed for different synchronization needs
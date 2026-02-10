# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/sharded_list.rs
@source-hash: 3f88d21e0db1f9c0
@generated: 2026-02-09T18:06:55Z

## Purpose
High-performance, concurrent intrusive linked list that shards operations across multiple sub-lists to reduce contention in multi-threaded environments. Part of Tokio's internal utilities for managing collections of linked items efficiently.

## Key Types

**ShardedList<L, T> (L15-20)**
- Core sharded list structure with configurable number of shards (must be power of 2)
- Contains array of mutex-protected LinkedList instances
- Tracks metrics: `added` (total items added), `count` (current items)
- Uses `shard_mask` for fast modulo operations via bitwise AND

**ShardedListItem trait (L28-32)**
- Unsafe trait defining how items determine their shard placement
- Requires `get_shard_id()` method that must return consistent values for same item
- Critical invariant: shard ID cannot change for an item's lifetime

**ShardGuard<'a, L, T> (L54-59)**
- RAII guard providing exclusive access to a specific shard
- Holds mutex guard and references to shared metrics
- Enables atomic push operations with proper bookkeeping

## Core Operations

**new(sharded_size) (L36-50)**
- Creates array of empty LinkedList instances protected by mutexes
- Validates size is power of two for efficient shard selection
- Initializes atomic counters

**pop_back(shard_id) (L64-71)**
- Removes last element from specified shard
- Decrements count atomically on successful removal
- Direct shard access by ID

**remove(node) (L81-91)**
- Unsafe removal of specific node using its shard ID
- Leverages shard ID immutability for safe concurrent access
- Updates count on successful removal

**lock_shard(val) (L94-102)**
- Acquires exclusive lock on shard containing given value
- Returns ShardGuard for safe mutations
- Determines shard via ShardedListItem::get_shard_id()

**ShardGuard::push(val) (L137-143)**
- Adds item to front of locked shard
- Validates item belongs to correct shard (assertion)
- Atomically updates both added and count metrics

## Architectural Patterns

**Lock Sharding**: Reduces contention by distributing items across multiple mutexes based on item-specific shard IDs

**Intrusive Design**: Items contain their own link pointers, reducing memory allocations

**Metric Tracking**: Uses atomic counters for lock-free length queries and addition tracking

**Fast Shard Selection**: Uses bitwise AND with shard_mask for O(1) shard selection

## Dependencies
- `LinkedList` from super module for actual list implementation
- `MetricAtomicU64/Usize` for concurrent counter operations
- Loom-compatible synchronization primitives

## Conditional Features
- 64-bit metrics compilation guard (L109-114)
- Task dump functionality for iteration (L146-161)
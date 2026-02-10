# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/list.rs
@source-hash: 9c16169df286c6c6
@generated: 2026-02-09T18:03:17Z

## Purpose & Responsibility

Task storage containers for Tokio runtime schedulers. Provides two complementary task collection types: `OwnedTasks` for thread-safe storage of Send tasks, and `LocalOwnedTasks` for non-thread-safe storage of non-Send tasks. Both containers support graceful shutdown by preventing new task additions during scheduler termination.

## Key Components

### OwnedTasks<S> (L58-232)
Thread-safe task container using sharded linked lists for concurrent access:
- **Fields**: `list` (sharded list), `id` (unique identifier), `closed` (atomic shutdown flag) (L59-62)
- **new()** (L78-85): Creates container with shard size optimized for core count
- **bind()** (L89-104): Binds Send + 'static futures to scheduler, returns JoinHandle + optional Notified
- **bind_local()** (L110-125): Unsafe binding for non-Send futures (LocalRuntime only)
- **bind_inner()** (L128-148): Core binding logic with shutdown check
- **close_and_shutdown_all()** (L168-184): Graceful shutdown starting from specified shard
- **assert_owner()** (L153-161): Converts Notified to LocalNotified with ownership verification
- **remove()** (L201-211): Safe task removal with ownership validation

### LocalOwnedTasks<S> (L66-349)
Single-threaded task container for non-Send tasks:
- **Fields**: `inner` (UnsafeCell wrapper), `id` (unique identifier), `_not_send_or_sync` (phantom marker) (L67-70)
- **OwnedTasksInner**: Contains LinkedList and boolean closed flag (L72-75)
- **bind()** (L258-288): Binds non-Send futures, checks closure before insertion
- **close_and_shutdown_all()** (L292-301): Sequential shutdown of all tasks
- **with_inner()** (L332-340): Safe UnsafeCell access pattern
- **assert_owner()** (L318-329): Ownership verification for LocalNotified conversion

### ID Generation System (L28-56)
Platform-specific atomic counters for unique task collection identification:
- Uses AtomicU64 on 64-bit platforms, AtomicU32 on others
- **get_next_id()**: Returns NonZeroU64 IDs starting from 1, handles overflow by retry loop

## Architecture & Patterns

**Sharded Design**: OwnedTasks uses `sharded_list::ShardedList` to reduce lock contention in multi-threaded scenarios. Shard size calculation (L228-231) balances concurrency vs memory locality.

**Ownership Safety**: Both containers use unique IDs to verify task ownership before operations, preventing cross-container task manipulation.

**Graceful Shutdown**: Atomic/boolean flags prevent new task binding during shutdown while ensuring existing tasks complete properly.

**Type Safety**: PhantomData markers and unsafe blocks clearly delineate Send vs non-Send task boundaries.

## Dependencies

- `crate::runtime::task`: Core task types (JoinHandle, Notified, LocalNotified, Task)
- `crate::util::linked_list`: Intrusive linked list implementation
- `crate::util::sharded_list`: Concurrent sharded list for OwnedTasks
- `crate::loom`: Cross-platform atomic and synchronization primitives

## Critical Invariants

1. Task IDs must match container IDs before removal/conversion operations
2. LocalOwnedTasks must never be accessed concurrently (enforced by !Send + !Sync)
3. Closed containers reject new task bindings but allow existing task operations
4. Shard iteration in close_and_shutdown_all uses round-robin starting points to reduce contention
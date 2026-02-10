# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/queues.py
@source-hash: f4721a323ab2981a
@generated: 2026-02-09T18:11:22Z

## Primary Purpose
Implements multiprocessing-safe queue data structures for inter-process communication using pipes, locks, and background threads. Part of Python's multiprocessing module providing thread-safe and process-safe queue implementations.

## Key Classes

### Queue (L35-304)
Full-featured multiprocessing queue with bounded capacity and background thread for data transfer.

**Key Methods:**
- `__init__(maxsize=0, *, ctx)` (L37-55): Creates pipe-based queue with semaphore bounds, platform-specific locking (no write lock on Windows)
- `put(obj, block=True, timeout=None)` (L86-96): Thread-safe enqueue with blocking/timeout support, starts background thread lazily
- `get(block=True, timeout=None)` (L98-122): Thread-safe dequeue with timeout handling and automatic deserialization
- `_start_thread()` (L175-212): Creates daemon thread running `_feed()` to transfer data from buffer to pipe
- `_feed()` (L232-292): Static method running in background thread, handles serialization and pipe writing with error recovery

**Internal State:**
- `_buffer` (L76): `collections.deque` for buffering objects before pipe transfer
- `_reader/_writer` (L42): Unidirectional pipe endpoints from `connection.Pipe()`
- `_sem` (L49): `BoundedSemaphore` enforcing queue capacity limits
- `_rlock/_wlock` (L43,48): Read/write locks (write lock None on Windows due to atomic pipe writes)

### JoinableQueue (L316-353)
Extends Queue with task tracking for producer-consumer synchronization patterns.

**Key Methods:**
- `task_done()` (L343-348): Decrements unfinished task counter, notifies waiting threads when all tasks complete
- `join()` (L350-353): Blocks until all enqueued tasks marked as done via `task_done()`
- Overridden `put()` (L330-341): Increments `_unfinished_tasks` semaphore on each enqueue

### SimpleQueue (L359-401)  
Lightweight queue without capacity limits or background threads - direct pipe operations with locking.

**Key Methods:**
- `get()` (L385-389): Blocking read with deserialization, no timeout support
- `put(obj)` (L391-399): Immediate serialization and pipe write, platform-specific locking

## Critical Dependencies
- `connection.Pipe()` (L42,362): Provides underlying IPC mechanism
- `_ForkingPickler` (L27): Process-safe object serialization from `context.reduction`
- `threading.Thread` (L180): Background thread for Queue's async data transfer
- `ctx` parameter: Multiprocessing context providing synchronized primitives

## Architecture Patterns
- **Producer-Consumer**: Background thread (`_feed`) transfers data from in-memory buffer to pipe
- **Platform Abstraction**: Conditional write locking based on `sys.platform` (Windows pipes are atomic)
- **Lazy Initialization**: Background thread only created on first `put()` operation
- **Graceful Cleanup**: `Finalize` objects handle thread joining and resource cleanup during garbage collection

## Critical Invariants
- Queue capacity enforced by `BoundedSemaphore` - `put()` blocks when full
- Serialization occurs before lock acquisition to minimize critical sections
- `_sentinel` object (L306) signals background thread termination
- JoinableQueue task counter must not underflow (ValueError on excess `task_done()` calls)
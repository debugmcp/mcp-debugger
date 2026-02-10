# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/queue.py
@source-hash: f6c37fc37cd74409
@generated: 2026-02-09T18:09:04Z

## Multi-Producer, Multi-Consumer Queue Implementation

This is Python's standard library queue module providing thread-safe queue implementations with different ordering behaviors. The module implements the producer-consumer pattern with proper synchronization primitives.

### Core Components

**Exception Classes:**
- `Empty` (L17-21): Raised when attempting non-blocking operations on empty queues
- `Full` (L23-25): Raised when attempting non-blocking operations on full bounded queues

**Main Queue Class - `Queue` (L28-221):**
Thread-safe FIFO queue with optional size limits. Uses three condition variables sharing a single mutex for coordination:
- `mutex` (L42): Primary lock for all queue mutations
- `not_empty` (L46): Signals when items are added, wakes waiting consumers
- `not_full` (L50): Signals when items are removed, wakes waiting producers  
- `all_tasks_done` (L54): Signals when all enqueued work is completed via `task_done()`

**Key Methods:**
- `put(item, block=True, timeout=None)` (L122-152): Thread-safe enqueue with blocking/timeout support
- `get(block=True, timeout=None)` (L154-183): Thread-safe dequeue with blocking/timeout support
- `task_done()` (L57-77): Decrements unfinished task counter, enables work completion tracking
- `join()` (L79-90): Blocks until all enqueued items are processed (task_done() called)

**Template Methods (L206-218):**
- `_init(maxsize)`: Initialize underlying storage (deque for FIFO)
- `_put(item)`: Insert item into storage  
- `_get()`: Remove item from storage
- `_qsize()`: Return storage size

### Queue Variants

**PriorityQueue (L223-239):**
Inherits Queue, overrides template methods to use heapq for min-heap ordering. Items should be comparable tuples like `(priority, data)`.

**LifoQueue (L242-255):**
Inherits Queue, implements stack (LIFO) behavior using list with append/pop operations.

**SimpleQueue Implementation:**
- Attempts import of C extension `_queue.SimpleQueue` (L8-11)
- Falls back to pure Python `_PySimpleQueue` (L258-322) if unavailable
- Unbounded FIFO queue using deque + semaphore, simpler than full Queue class
- No task tracking, no size limits, optimized for basic producer-consumer patterns

### Architecture Patterns

**Template Method Pattern:** Base Queue defines algorithm structure, subclasses customize storage behavior via `_init`, `_put`, `_get`, `_qsize`.

**Condition Variable Coordination:** Uses multiple condition variables on shared mutex to avoid spurious wakeups and enable fine-grained blocking.

**Graceful Fallbacks:** Attempts to import optimized C implementations before falling back to pure Python versions.

**Generic Type Support:** All queue classes support `__class_getitem__` for type hinting (L220, L322).

### Critical Invariants

- All public methods acquire appropriate locks before mutation
- `unfinished_tasks` counter tracks put/task_done balance for work completion detection  
- Timeout values must be non-negative or None
- Thread-safety depends on proper condition variable usage patterns
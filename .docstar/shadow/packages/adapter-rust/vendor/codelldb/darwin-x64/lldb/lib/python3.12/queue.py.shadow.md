# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/queue.py
@source-hash: f6c37fc37cd74409
@generated: 2026-02-09T18:07:58Z

## Multi-Producer, Multi-Consumer Queue Implementation

Thread-safe queue implementations for Python, providing FIFO, LIFO, and priority queue variants with optional size limits and task tracking.

### Core Classes

**Queue (L28-220)** - Primary thread-safe FIFO queue implementation
- Constructor accepts `maxsize` parameter (0 = unlimited) (L34-56)
- Uses threading.Lock and three Condition objects for synchronization
- Key synchronization primitives:
  - `mutex` - protects all queue mutations (L42)
  - `not_empty` - signals when items added (L46)
  - `not_full` - signals when space available (L50)
  - `all_tasks_done` - signals when all tasks completed (L54)
- Task tracking with `unfinished_tasks` counter (L55)

**PriorityQueue (L223-240)** - Min-heap based priority queue
- Inherits from Queue, overrides storage methods
- Uses heapq for priority ordering (lowest first)
- Expects items as (priority, data) tuples

**LifoQueue (L242-256)** - Last-in-first-out stack implementation
- Inherits from Queue, uses list with append/pop for LIFO behavior

**_PySimpleQueue (L258-323)** - Unbounded FIFO queue (Python fallback)
- Pure Python implementation when C extension unavailable
- Uses deque + Semaphore for thread safety
- No size limits, simpler than Queue class

### Key Methods

**Queue Operations:**
- `put(item, block=True, timeout=None)` (L122-153) - Add item with blocking/timeout control
- `get(block=True, timeout=None)` (L154-184) - Remove item with blocking/timeout control
- `put_nowait(item)` (L185-191) - Non-blocking put (raises Full if no space)
- `get_nowait()` (L193-199) - Non-blocking get (raises Empty if no items)

**Task Management:**
- `task_done()` (L57-78) - Mark task as completed, notify join() waiters
- `join()` (L79-91) - Block until all tasks completed

**Status Methods:**
- `qsize()` (L92-95) - Approximate queue size (thread-unsafe)
- `empty()` (L97-110) - Check if empty (thread-unsafe)
- `full()` (L111-121) - Check if full (thread-unsafe)

### Exception Classes

- **Empty (L17-21)** - Raised by non-blocking get operations
- **Full (L23-25)** - Raised by non-blocking put operations

### Architecture Patterns

**Template Method Pattern** - Queue class defines abstract methods for subclassing:
- `_init(maxsize)` (L206-207) - Initialize storage
- `_qsize()` (L209-210) - Get storage size
- `_put(item)` (L213-214) - Add item to storage
- `_get()` (L217-218) - Remove item from storage

**Conditional Wait Pattern** - Uses threading.Condition for producer/consumer coordination with timeout support

**Graceful Fallback** - Attempts to import C extension SimpleQueue, falls back to pure Python implementation (L8-11, L325-326)

### Dependencies

- `threading` - Lock, Condition, Semaphore for thread safety
- `collections.deque` - FIFO storage for Queue and SimpleQueue
- `heapq` - Priority queue implementation
- `time.monotonic` - Timeout calculations
- `types.GenericAlias` - Generic type support (L220, L322)

### Critical Invariants

- All queue mutations must hold mutex
- Task counter (`unfinished_tasks`) incremented on put(), decremented on task_done()
- Timeout values must be non-negative
- Size limits enforced only when maxsize > 0
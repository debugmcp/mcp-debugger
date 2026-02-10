# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/queue.py
@source-hash: f6c37fc37cd74409
@generated: 2026-02-09T18:14:26Z

## Purpose
Thread-safe queue implementations providing multi-producer, multi-consumer functionality with various ordering strategies (FIFO, LIFO, priority). Part of Python's standard library queue module implementation.

## Key Classes & Functions

### Exception Classes
- **Empty (L17-21)**: Exception raised when queue operations fail due to empty queue
- **Full (L23-25)**: Exception raised when queue operations fail due to full queue

### Queue (L28-220) - Base FIFO Queue
Thread-safe FIFO queue with configurable maximum size. Uses three condition variables for coordination:
- `mutex` (L42): Primary lock for queue mutations
- `not_empty` (L46): Signals when items are available 
- `not_full` (L50): Signals when space is available
- `all_tasks_done` (L54): Signals when all enqueued tasks are processed

**Key Methods:**
- `__init__(maxsize=0)` (L34): Creates queue with optional size limit (unlimited if ≤ 0)
- `put(item, block=True, timeout=None)` (L122): Thread-safe item insertion with blocking/timeout options
- `get(block=True, timeout=None)` (L154): Thread-safe item removal with blocking/timeout options
- `task_done()` (L57): Decrements unfinished task counter, enables join() coordination
- `join()` (L79): Blocks until all queued items are processed via task_done() calls
- `qsize()`, `empty()`, `full()` (L92-120): Non-reliable status checks due to race conditions

**Internal Methods (L206-218):**
- `_init()`, `_qsize()`, `_put()`, `_get()`: Template methods for subclass customization

### PriorityQueue (L223-240)
Extends Queue using heapq for priority-ordered retrieval (lowest priority first). Expects tuple entries like `(priority, data)`.

### LifoQueue (L242-256) 
Extends Queue for LIFO (stack) behavior using list with append/pop operations.

### _PySimpleQueue (L258-323)
Pure Python implementation of unbounded FIFO queue using semaphore-based counting instead of condition variables. Simpler than Queue but lacks size limits and task tracking.

**Key Features:**
- Uses `threading.Semaphore` (L270) for item counting
- No size restrictions (unbounded)
- Compatible API with Queue class
- Fallback when C implementation unavailable

## Dependencies
- `threading`: Locks, conditions, semaphores for thread safety
- `collections.deque`: Efficient FIFO operations for base Queue and SimpleQueue
- `heapq`: Priority queue operations for PriorityQueue
- `time.monotonic`: Timeout calculations
- `_queue`: Optional C implementation fallback

## Architectural Patterns
- **Template Method**: Base Queue class defines algorithm, subclasses customize via `_init()`, `_put()`, `_get()`, `_qsize()`
- **Producer-Consumer**: Condition variables coordinate between producers (put) and consumers (get)
- **Task Tracking**: Optional workflow coordination via `task_done()`/`join()` pattern
- **Graceful Degradation**: Falls back to pure Python SimpleQueue if C extension unavailable

## Critical Constraints
- All public methods are thread-safe via mutex/condition synchronization
- Status methods (`empty()`, `full()`, `qsize()`) are inherently unreliable due to race conditions
- Timeout values must be non-negative
- `task_done()` calls must match `put()` calls to avoid ValueError
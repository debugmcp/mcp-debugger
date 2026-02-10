# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/queue.py
@source-hash: f6c37fc37cd74409
@generated: 2026-02-09T18:07:18Z

## Queue Module - Multi-Producer Multi-Consumer Queues

**Primary Purpose**: Provides thread-safe queue implementations with blocking/non-blocking operations and various retrieval orderings (FIFO, LIFO, priority).

### Core Architecture
- **Exception Classes**: `Empty` (L17-21), `Full` (L23-25) for queue state errors
- **Base Queue Class**: `Queue` (L28-221) - thread-safe FIFO with size limits
- **Specialized Variants**: `PriorityQueue` (L223-240), `LifoQueue` (L242-256)
- **Simple Queue**: `_PySimpleQueue` (L258-323) - unbounded, no task tracking

### Key Classes and Responsibilities

**Queue (L28-221)**
- **Constructor** (L34-56): Sets up threading primitives (mutex, conditions) and task tracking
- **Core Operations**:
  - `put()` (L122-153): Blocks until space available, supports timeout
  - `get()` (L154-184): Blocks until item available, supports timeout  
  - `put_nowait()`/`get_nowait()` (L185-199): Non-blocking variants
- **Task Management**:
  - `task_done()` (L57-78): Decrements unfinished task counter
  - `join()` (L79-91): Blocks until all tasks completed
- **State Queries**: `qsize()`, `empty()`, `full()` (L92-121) - unreliable in concurrent context
- **Template Methods** (L206-219): `_init()`, `_put()`, `_get()`, `_qsize()` for subclass customization

**PriorityQueue (L223-240)**
- Inherits from Queue, uses heapq for min-heap ordering
- Items retrieved in priority order (lowest first)
- Expects tuples: `(priority, data)`

**LifoQueue (L242-256)** 
- Inherits from Queue, implements stack behavior (LIFO)
- Uses list with append/pop for last-in-first-out retrieval

**_PySimpleQueue (L258-323)**
- Pure Python fallback when C extension unavailable
- Unbounded capacity, no task tracking
- Uses `threading.Semaphore` for blocking behavior
- Simpler than Queue but less feature-complete

### Threading Synchronization Pattern
All queue classes use condition variables with shared mutex:
- `not_empty` condition: Signals when items added
- `not_full` condition: Signals when space available  
- `all_tasks_done` condition: Signals when task counter reaches zero

### Key Dependencies
- `threading`: Core synchronization primitives
- `collections.deque`: Efficient double-ended queue for FIFO
- `heapq`: Priority queue implementation
- `time.monotonic`: Timeout handling
- `_queue`: Optional C extension for performance

### Critical Invariants
- All queue mutations must hold appropriate locks
- Task counter incremented on `put()`, decremented on `task_done()`
- Timeout values must be non-negative
- Size queries (`empty()`, `full()`, `qsize()`) are inherently unreliable in concurrent contexts
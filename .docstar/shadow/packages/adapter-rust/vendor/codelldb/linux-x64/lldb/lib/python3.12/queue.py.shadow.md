# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/queue.py
@source-hash: f6c37fc37cd74409
@generated: 2026-02-09T18:09:54Z

## Multi-producer, Multi-consumer Queue Module

**Purpose:** Thread-safe queue implementations providing FIFO, LIFO, and priority queue variants for concurrent programming.

### Core Components

#### Exception Classes
- **Empty (L17-21):** Raised when attempting to get from empty queue without blocking
- **Full (L23-25):** Raised when attempting to put to full queue without blocking

#### Primary Queue Class (L28-221)
- **Queue (L28-221):** Base thread-safe queue with configurable max size
  - Uses `deque` for internal storage
  - Three condition variables for synchronization:
    - `not_empty` (L46): Signals when items available
    - `not_full` (L50): Signals when space available  
    - `all_tasks_done` (L54): Signals when all tasks completed
  - Key methods:
    - `put()` (L122-153): Add item with blocking/timeout control
    - `get()` (L154-184): Remove item with blocking/timeout control
    - `task_done()` (L57-78): Mark task completion for join() synchronization
    - `join()` (L79-91): Block until all tasks processed
  - Template methods for subclass customization:
    - `_init()` (L206), `_qsize()` (L209), `_put()` (L213), `_get()` (L217)

#### Queue Variants
- **PriorityQueue (L223-240):** Uses heapq for priority-based retrieval (lowest first)
- **LifoQueue (L242-256):** Stack behavior (last-in-first-out) using list
- **_PySimpleQueue (L258-323):** Unbounded FIFO with semaphore-based counting

### Key Architectural Patterns

**Template Method Pattern:** Base Queue class defines algorithm structure, subclasses override `_init`, `_qsize`, `_put`, `_get` methods for different ordering behaviors.

**Condition Variable Coordination:** Uses three condition variables sharing single mutex to coordinate producer/consumer interactions and task completion tracking.

**Fallback Implementation:** Attempts to import C-optimized `_queue` module, falls back to pure Python implementations if unavailable (L8-11, L325-326).

### Critical Invariants
- All queue mutations must hold `mutex` lock
- `unfinished_tasks` counter tracks items added via `put()` minus `task_done()` calls
- Timeout values must be non-negative or None
- Queue size checks are inherently unreliable in concurrent contexts

### Dependencies
- **threading:** Lock and Condition primitives for synchronization
- **collections.deque:** Default FIFO storage
- **heapq:** Priority queue implementation
- **time.monotonic:** Timeout calculations
- **types.GenericAlias:** Generic type support (L220, L322)
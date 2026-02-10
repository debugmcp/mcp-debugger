# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/queues.py
@source-hash: 8f020744ebd1f557
@generated: 2026-02-09T18:11:21Z

**Purpose**: Async queue implementations for coordinating producer-consumer coroutines in asyncio applications. Provides thread-safe FIFO, priority, and LIFO queue variants with blocking and non-blocking operations.

## Core Classes

### Queue (L21-216)
Main asyncio queue implementation inheriting from `mixins._LoopBoundMixin`. Core responsibility is coordinating async producers and consumers with optional size limits.

**Key Components:**
- `__init__(maxsize=0)` (L33-43): Creates unlimited queue (maxsize≤0) or size-limited queue
- `_queue`: Internal storage (deque by default)
- `_getters`/`_putters`: Deques of Future objects for blocked coroutines
- `_unfinished_tasks`: Counter for join/task_done coordination
- `_finished`: Event for join() blocking

**Core Operations:**
- `put(item)` (L110-135): Async put with blocking when full
- `put_nowait(item)` (L137-147): Non-blocking put, raises QueueFull
- `get()` (L149-173): Async get with blocking when empty  
- `get_nowait()` (L175-184): Non-blocking get, raises QueueEmpty
- `task_done()` (L186-204): Decrements unfinished task counter
- `join()` (L206-215): Blocks until all tasks completed

**Template Methods (overridable):**
- `_init(maxsize)` (L47-48): Initialize internal storage
- `_get()` (L50-51): Extract item from storage
- `_put(item)` (L53-54): Insert item into storage

### PriorityQueue (L218-231)
Heap-based priority queue retrieving lowest priority items first. Overrides storage methods to use heapq operations on list instead of deque.

### LifoQueue (L234-244) 
Stack-based queue retrieving most recently added items first. Uses list with append/pop operations.

## Exception Types
- `QueueEmpty` (L11-13): Raised by non-blocking get on empty queue
- `QueueFull` (L16-18): Raised by non-blocking put on full queue

## Key Patterns
- **Future-based coordination**: Uses Future objects in `_getters`/`_putters` deques for async blocking
- **Template method pattern**: Subclasses override `_init`, `_get`, `_put` for different storage behaviors  
- **Task tracking**: `_unfinished_tasks` counter enables join() functionality
- **Exception handling**: Careful cleanup of cancelled futures in put/get exception paths

## Dependencies
- `collections`: deque for FIFO storage and waiter queues
- `heapq`: heap operations for PriorityQueue
- `locks`: Event primitive for join coordination
- `mixins._LoopBoundMixin`: Base class providing event loop access
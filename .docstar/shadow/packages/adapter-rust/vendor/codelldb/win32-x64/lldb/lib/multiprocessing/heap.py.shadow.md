# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/heap.py
@source-hash: f6bb79bb99b9ae48
@generated: 2026-02-09T18:11:22Z

## Purpose
Memory heap management for multiprocessing with mmap-backed shared memory allocation. Provides cross-platform Arena abstractions and a Heap allocator that manages memory blocks within those arenas.

## Key Classes

### Arena (L31-64 Windows, L67-109 POSIX)
Platform-specific shared memory arena implementations:
- **Windows**: Anonymous memory mapping with unique tagnames (L31-64)
- **POSIX**: Temporary file-backed memory with preference for `/dev/shm` on Linux (L67-109)
- Supports pickle/unpickle for cross-process sharing via `__getstate__`/`__setstate__`
- POSIX version includes reduction functions for proper serialization (L100-109)

### Heap (L115-317)
Core memory allocator managing multiple arenas:
- **Configuration**: 8-byte alignment, 4MB discard threshold, arena doubling until 4MB (L118-122)
- **Data structures**: 
  - `_lengths`: sorted list of available block sizes (L129)
  - `_len_to_seq`: maps block sizes to available blocks (L133)
  - `_start_to_block`/`_stop_to_block`: maps arena positions to blocks (L134-139)
  - `_allocated_blocks`: tracks in-use blocks per arena (L142)
- **Key methods**:
  - `malloc(size)`: allocates rounded-up blocks, creates new arenas as needed (L296-316)
  - `free(block)`: deallocates with coalescing, handles async GC calls (L268-294)
  - `_malloc(size)`: internal allocation using best-fit from sorted sizes (L188-203)
  - `_add_free_block(block)`: merges adjacent free blocks (L205-233)

### BufferWrapper (L322-337)
Public interface wrapping heap-allocated memory blocks:
- Uses singleton `_heap` instance (L324)
- Auto-cleanup via `util.Finalize` (L333)
- `create_memoryview()`: returns memoryview of allocated region (L335-337)

## Key Algorithms

**Block Coalescing (L205-233)**: When freeing blocks, automatically merges with adjacent free blocks in same arena to reduce fragmentation.

**Best-Fit Allocation (L188-203)**: Uses `bisect.bisect_left()` on sorted length list for efficient size-based block lookup.

**Async-Safe Freeing (L268-294)**: Uses trylock with pending block list to handle GC-initiated frees without deadlocking.

**Arena Lifecycle**: Creates progressively larger arenas (doubling until 4MB), discards unused arenas over 4MB threshold.

## Dependencies
- `mmap`, `tempfile`: Core memory mapping
- `threading.Lock`: Thread synchronization 
- `bisect`: Efficient sorted list operations
- Platform-specific: `_winapi` (Windows), `/dev/shm` preference (Linux)
- `.context.reduction`, `.util`: Multiprocessing infrastructure

## Critical Invariants
- Thread-safe heap operations via `self._lock`
- Process-safety: reinitializes after fork detection (L302-303)
- Block alignment to 8-byte boundaries
- Arena reference counting prevents premature cleanup
- GC-safe async freeing via pending block mechanism
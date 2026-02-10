# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/threads.py
@source-hash: 39d3729538364156
@generated: 2026-02-09T18:10:19Z

**Purpose:** Provides high-level asyncio utilities for executing synchronous functions in separate threads while preserving context variables.

**Core Functionality:**
- `to_thread(func, /, *args, **kwargs)` (L12-25): Asynchronous wrapper that executes synchronous functions in thread pool
  - Uses positional-only parameter pattern for `func`
  - Captures current `contextvars.Context` and propagates it to worker thread
  - Leverages event loop's default thread pool executor via `run_in_executor(None, ...)`
  - Returns awaitable coroutine that yields function result

**Key Dependencies:**
- `functools.partial` for creating context-aware function wrapper
- `contextvars.copy_context()` for context propagation across threads
- `events.get_running_loop()` for accessing current event loop

**Implementation Pattern:**
The function follows asyncio's standard thread delegation pattern:
1. Get running event loop (L22)
2. Capture current context (L23)
3. Create partial function that runs in captured context (L24)
4. Submit to thread pool executor and await result (L25)

**Architectural Notes:**
- Part of asyncio's high-level API for thread integration
- Ensures context variables (like request IDs, user sessions) remain accessible in worker threads
- Uses default thread pool (None executor) rather than custom ThreadPoolExecutor
- Enables seamless integration of CPU-bound sync code in async applications
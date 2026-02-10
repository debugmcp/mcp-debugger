# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/futures.py
@source-hash: 07d84ab63d32e044
@generated: 2026-02-09T18:12:24Z

**Primary Purpose:**
Core asyncio.Future implementation that provides PEP 3148-style futures for asynchronous programming. This file implements the fundamental Future class used throughout asyncio for representing delayed computations and their eventual results or exceptions.

**Key Classes and Functions:**

- **Future (L30-296)**: Main asyncio future class implementing the Future protocol
  - Constructor (L72-86): Initializes with optional event loop, sets up callbacks list and debug traceback
  - State management: Uses _PENDING, _CANCELLED, _FINISHED states from base_futures
  - Key methods:
    - `cancel(msg=None)` (L146-159): Cancels future and schedules callbacks
    - `result()` (L189-204): Returns result or raises if cancelled/not ready
    - `exception()` (L206-220): Returns exception or raises if cancelled/not ready
    - `set_result(result)` (L253-263): Marks future done with result
    - `set_exception(exception)` (L265-286): Marks future done with exception
    - `add_done_callback(fn, *, context=None)` (L222-234): Adds completion callback
    - `__await__()` (L288-294): Enables await/yield from syntax

**Internal Helper Functions:**

- **_get_loop(fut)** (L303-312): Safely extracts event loop from future object
- **_set_result_unless_cancelled(fut, result)** (L315-319): Conditional result setting
- **_convert_future_exc(exc)** (L322-331): Converts concurrent.futures exceptions to asyncio exceptions
- **_copy_future_state(source, dest)** (L349-366): Copies completion state between futures
- **_chain_future(source, destination)** (L369-410): Links two futures for state propagation
- **wrap_future(future, *, loop=None)** (L413-423): Wraps concurrent.futures.Future as asyncio.Future

**Key Dependencies:**
- `base_futures`: Provides state constants and isfuture() function
- `events`: Event loop management
- `exceptions`: Asyncio-specific exception types
- `concurrent.futures`: Standard library future compatibility
- `contextvars`: Context variable support for callbacks

**Important Design Patterns:**
- State machine with three states: PENDING, CANCELLED, FINISHED
- Callback scheduling through event loop's call_soon()
- Context preservation for callbacks using contextvars
- Exception chaining and traceback preservation
- Duck-typing compatibility with concurrent.futures.Future
- C extension fallback mechanism (L426-432) - imports _asyncio.Future if available

**Critical Invariants:**
- Futures are not thread-safe (unlike concurrent.futures.Future)
- Once done (cancelled/finished), state cannot change
- Callbacks always execute via event loop scheduling
- StopIteration exceptions are wrapped in RuntimeError to prevent generator issues
- _asyncio_future_blocking flag enables Task differentiation between await and yield
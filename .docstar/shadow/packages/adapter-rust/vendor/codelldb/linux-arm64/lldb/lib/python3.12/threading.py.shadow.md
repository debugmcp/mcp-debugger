# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/threading.py
@source-hash: 63c306a32ed31551
@generated: 2026-02-09T18:09:38Z

## Python Threading Module Implementation

This is Python's core `threading.py` module that provides high-level thread synchronization primitives and thread management functionality. It emulates a subset of Java's threading model while providing Python-specific adaptations.

### Primary Purpose
- Provides thread-safe synchronization primitives (locks, conditions, semaphores, events, barriers)
- Manages thread lifecycle and state tracking
- Implements thread-local storage and profiling/tracing hooks
- Handles graceful shutdown and cleanup of threads

### Key Dependencies
- `_thread` module (low-level C threading primitives) (L35-66)
- `_weakrefset.WeakSet` for dangling thread tracking (L9)
- `collections.deque` for condition variable waiters (L12-14)
- `time.monotonic` for timeout handling (L8)

### Core Classes

#### Thread (L873-1304)
Main thread abstraction with lifecycle management:
- `__init__()` (L884-942): Thread configuration with target, name, args, daemon status
- `start()` (L975-999): Initiates thread execution via `_bootstrap()`
- `run()` (L1001-1016): Override point for thread activity
- `join()` (L1117-153): Blocks until thread completion with optional timeout
- `_bootstrap_inner()` (L1058-1079): Internal thread startup with profiling/tracing setup
- Properties: `name`, `ident`, `native_id`, `daemon`, `is_alive()`

#### Synchronization Primitives

##### _RLock (L137-261)
Reentrant lock implementation:
- `acquire()` (L172-206): Supports blocking/non-blocking with timeout, tracks recursion
- `release()` (L210-234): Decrements count, releases when zero
- Internal methods for condition variables: `_acquire_restore()`, `_release_save()`, `_is_owned()`

##### Condition (L265-443)
Condition variable for thread coordination:
- `wait()` (L323-369): Releases lock, waits for notification, reacquires lock
- `wait_for()` (L371-392): Waits until predicate becomes true
- `notify()` (L394-422): Wakes up waiting threads
- Uses deque for waiter management (L293)

##### Semaphore (L445-530)
Counting semaphore with internal counter:
- `acquire()` (L468-511): Decrements counter, blocks if zero
- `release()` (L515-526): Increments counter, notifies waiters

##### BoundedSemaphore (L532-575)
Semaphore with upper bound checking to prevent over-release

##### Event (L577-657)
Simple signaling mechanism:
- `set()` (L616-625): Sets flag, notifies all waiters
- `wait()` (L637-656): Blocks until flag is set
- `clear()` (L627-635): Resets flag

##### Barrier (L670-831)
Synchronization point for fixed number of threads:
- `wait()` (L704-730): Blocks until all parties reach barrier
- Complex state machine: filling(0), draining(1), resetting(-1), broken(-2) (L694)
- `reset()` (L777-795): Resets barrier, breaks waiting threads

### Global Thread Management

#### Active Thread Tracking (L843-869)
- `_active`: Maps thread IDs to Thread objects (L847)
- `_limbo`: Threads being started (L848)  
- `_dangling`: WeakSet of all thread instances (L849)
- `_active_limbo_lock`: Reentrant lock for thread registry access (L846)

#### Shutdown Mechanism (L851-868, L575-629)
- `_shutdown_locks`: Tracks non-daemon thread locks for clean shutdown (L855)
- `_shutdown()` (L575-629): Waits for all non-daemon threads to complete
- `_after_fork()` (L649-705): Resets threading state after process fork

### Special Thread Classes

#### _MainThread (L439-450)
Represents the primary Python interpreter thread, auto-registered in `_active`

#### _DummyThread (L460-481) 
Placeholder for threads not created via threading module (e.g., C extension threads)

#### Timer (L409-435)
Delayed function execution thread that can be cancelled before execution

### Global API Functions
- `current_thread()` (L485-495): Returns Thread object for calling thread
- `enumerate()` (L535-544): Lists all alive threads
- `active_count()` (L508-518): Returns count of alive threads
- `main_thread()` (L631-638): Returns main thread object

### Profiling/Tracing Support (L71-118)
- `setprofile()`, `settrace()`: Set hooks for new threads
- `setprofile_all_threads()`, `settrace_all_threads()`: Set hooks for all threads
- Hooks automatically applied in `_bootstrap_inner()` (L1069-1072)

### Exception Handling (L306-404)
- `excepthook()` (L321-349): Handles uncaught thread exceptions
- `_make_invoke_excepthook()` (L356-404): Creates closure for exception handling during shutdown

### Architectural Patterns
- Factory pattern: `RLock()` function returns optimal implementation (L124-135)
- Template method: Thread.run() designed for override
- State machine: Barrier uses integer states for coordination
- Resource management: Context manager support (`__enter__`/`__exit__`) throughout
- Graceful degradation: Fallbacks for missing C implementations
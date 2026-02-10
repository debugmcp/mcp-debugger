# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/threading.py
@source-hash: 63c306a32ed31551
@generated: 2026-02-09T18:08:26Z

## Primary Purpose

Python's threading module implementation providing Java-inspired thread synchronization primitives and thread management. Core entry point for Python's thread-based parallelism with comprehensive synchronization objects, thread lifecycle management, and debugging support.

## Key Classes and Components

### Thread Management
- **Thread (L873-1304)**: Main thread class supporting constructor-based or subclass-based thread creation. Manages thread lifecycle (start/join/stop), daemon status, and exception handling. Key methods: `start()` (L975), `run()` (L1001), `join()` (L1117), `is_alive()` (L1222).
- **_MainThread (L1439-1449)**: Special thread representing the main interpreter thread, auto-initialized and registered in _active.
- **_DummyThread (L1460-1481)**: Placeholder for threads not created via threading module (e.g., C extension threads).
- **Timer (L1409-1434)**: Thread subclass for delayed function execution with cancellation support.

### Synchronization Primitives
- **Lock (L122)**: Basic mutual exclusion primitive (alias to _thread.allocate_lock).
- **RLock (L124-262)**: Reentrant lock allowing same thread to acquire multiple times. Factory function chooses between C (_CRLock) or Python (_PyRLock) implementation.
- **Condition (L265-443)**: Condition variable for wait/notify patterns. Uses underlying lock (RLock by default) with waiter queue management.
- **Semaphore (L445-530)**: Counting semaphore managing resource permits with blocking acquire/release.
- **BoundedSemaphore (L532-575)**: Semaphore with upper bound enforcement preventing over-release.
- **Event (L577-657)**: Boolean flag synchronization with set/clear/wait operations.
- **Barrier (L670-835)**: Synchronizes fixed number of threads at barrier points with cyclic reuse and action callbacks.

### Global Thread Management
- **Active thread tracking**: `_active` dict (L847) maps thread IDs to Thread objects, protected by `_active_limbo_lock` (L846).
- **Shutdown coordination**: `_shutdown_locks` (L855) tracks non-daemon thread locks for clean interpreter shutdown.
- **API functions**: `current_thread()` (L1485), `enumerate()` (L1535), `active_count()` (L1508).

### Exception Handling
- **excepthook system (L1306-1404)**: Handles uncaught exceptions in threads with fallback mechanisms for interpreter shutdown scenarios.
- **Profile/trace hooks (L71-118)**: Global profiling and tracing support for all threads.

### Key Internal Mechanisms
- **Fork safety (L1649-1705)**: `_after_fork()` reinitializes threading state after os.fork(), resetting locks and thread tracking.
- **Shutdown sequence (L1575-1629)**: `_shutdown()` coordinates clean thread termination during interpreter exit.
- **Thread state integration**: `_tstate_lock` mechanism coordinates with CPython's thread state management.

## Dependencies
- **_thread module**: Low-level threading primitives and C implementations
- **time.monotonic**: Timeout handling
- **WeakSet**: Dangling thread tracking
- **deque**: Waiter queue management in condition variables

## Architectural Notes
- **Java heritage**: Maintains Java-style camelCase aliases for backward compatibility alongside PEP 8 names
- **Hybrid C/Python**: Prefers C implementations when available, falls back to Python versions
- **Thread safety**: Extensive use of locks for internal state management
- **Interpreter integration**: Deep integration with CPython's thread state and shutdown mechanisms
- **Fork handling**: Comprehensive fork safety with state reset and lock reinitialization

## Critical Invariants
- Only one thread can hold a lock at a time (except reentrant locks by same thread)
- Thread objects must be started before joining
- Daemon status cannot be changed after thread starts
- Main thread coordinates shutdown of all non-daemon threads
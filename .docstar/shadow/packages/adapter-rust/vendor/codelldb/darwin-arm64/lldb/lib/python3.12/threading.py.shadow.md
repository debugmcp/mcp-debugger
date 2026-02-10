# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/threading.py
@source-hash: 63c306a32ed31551
@generated: 2026-02-09T18:07:41Z

## Python Threading Module (threading.py)

**Primary Purpose**: High-level thread interface for Python, providing object-oriented wrappers around the low-level `_thread` module. Implements Java-inspired threading model with synchronization primitives and thread management.

### Key Dependencies & Imports
- `_thread` module (low-level threading primitives) - L5, L35-66
- `time.monotonic` for timeout handling - L8 
- `_weakrefset.WeakSet` for dangling thread tracking - L9
- `collections.deque` for condition variable waiters - L12-14

### Global State & Configuration
- `_profile_hook`, `_trace_hook` (L71-72): Global profiling/tracing hooks applied to all threads
- `_active`, `_limbo` (L847-848): Thread registration dictionaries protected by `_active_limbo_lock`
- `_shutdown_locks` (L855): Set of non-daemon thread locks for shutdown coordination
- `_main_thread` (L1573): Main thread singleton instance

### Core Synchronization Primitives

**Lock & RLock (L122-262)**
- `Lock`: Direct alias to `_thread.allocate_lock()`
- `RLock()`: Factory function returning either C implementation (`_CRLock`) or pure Python `_PyRLock`
- `_RLock` class: Pure Python reentrant lock with owner tracking and recursion counting

**Condition (L265-442)**
- Condition variable implementation using underlying lock (defaults to RLock)
- Key methods: `wait()` (L323), `notify()` (L394), `notify_all()` (L424)
- Supports timeout and predicate-based waiting via `wait_for()` (L371)

**Semaphore & BoundedSemaphore (L445-575)**
- `Semaphore`: Counter-based synchronization primitive
- `BoundedSemaphore`: Prevents counter from exceeding initial value
- Both use Condition internally for blocking behavior

**Event (L577-657)**
- Simple boolean flag synchronization
- Methods: `set()`, `clear()`, `wait()`, `is_set()`

**Barrier (L670-834)**
- Synchronizes fixed number of threads at rendezvous points
- Complex state machine: filling (0), draining (1), resetting (-1), broken (-2)
- Supports optional action callback and timeout

### Thread Management

**Thread Class (L873-1304)**
- Main thread abstraction with lifecycle management
- Key methods:
  - `start()` (L975): Initiates thread execution via `_start_new_thread`
  - `run()` (L1001): Override point for thread activity
  - `join()` (L1117): Wait for thread termination
  - `is_alive()` (L1222): Check if thread is running
- Internal state tracking via `_started` Event and `_tstate_lock` sentinel
- Daemon thread support with inheritance from parent thread

**Specialized Thread Classes**
- `_MainThread` (L1439-1450): Represents main interpreter thread
- `_DummyThread` (L1460-1481): Placeholder for threads not created via threading module
- `Timer` (L1409-1435): Delayed function execution thread

### Exception Handling
- `excepthook()` (L1321-1349): Global handler for uncaught thread exceptions
- `_make_invoke_excepthook()` (L1356-1404): Creates closure preserving references for shutdown safety

### Global API Functions
- `current_thread()` (L1485): Get current Thread object or create DummyThread
- `active_count()` (L1508): Count of alive threads
- `enumerate()` (L1535): List all alive Thread objects
- `main_thread()` (L1631): Returns main thread singleton

### Shutdown & Fork Handling
- `_shutdown()` (L1575-1629): Coordinates clean interpreter shutdown by joining non-daemon threads
- `_after_fork()` (L1649-1705): Reinitializes threading state after process fork
- `_register_atexit()` (L1550-1564): Register cleanup functions for shutdown

### Legacy Compatibility
Multiple deprecated camelCase methods maintained for backward compatibility:
- `currentThread()`, `activeCount()`, `notifyAll()`, `isSet()`, etc.
- All emit DeprecationWarnings when used

### Architecture Notes
- Heavy use of context managers (`__enter__`/`__exit__`) for automatic lock management
- Robust timeout handling throughout using monotonic time
- Careful state management to handle interpreter shutdown and signal interruption
- Fork safety through complete state reinitialization
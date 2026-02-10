# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/synchronize.py
@source-hash: 9afc08f6d99deb0c
@generated: 2026-02-09T18:11:23Z

## Purpose
Multiprocessing synchronization primitives module that provides thread-safe and process-safe synchronization objects. Wraps low-level `_multiprocessing.SemLock` to provide high-level interfaces compatible with threading module equivalents but designed for inter-process communication.

## Key Classes

**SemLock (L46-125)** - Base wrapper class around `_multiprocessing.SemLock`
- `__init__(kind, value, maxvalue, *, ctx)` (L50-83): Creates semaphore with retry logic (up to 100 attempts) and context-aware cleanup
- `_make_methods()` (L90-92): Dynamically binds acquire/release methods from underlying semlock
- `__getstate__()/__setstate__()` (L100-119): Custom serialization handling Windows handle duplication and fork/spawn context validation
- `_make_name()` (L122-124): Generates unique semaphore names using process prefix and random sequence

**Semaphore (L130-143)** - Standard counting semaphore
- Inherits from SemLock with SEMAPHORE type and SEM_VALUE_MAX limit
- `get_value()` (L135-136): Returns current semaphore value

**BoundedSemaphore (L149-160)** - Semaphore with fixed upper bound
- Similar to Semaphore but maxvalue equals initial value (prevents release beyond initial count)

**Lock (L166-185)** - Non-recursive mutual exclusion lock
- Implemented as semaphore with value=1, maxvalue=1
- `__repr__()` provides detailed owner information including process/thread names

**RLock (L191-211)** - Recursive lock allowing multiple acquisitions by same thread
- Uses RECURSIVE_MUTEX type instead of SEMAPHORE
- Tracks acquisition count in representation

**Condition (L217-322)** - Condition variable for complex synchronization patterns
- `__init__(lock, *, ctx)` (L219-224): Uses RLock by default, creates internal semaphores for wait/notify
- `wait(timeout)` (L254-275): Releases lock, waits on semaphore, reacquires with original count
- `notify(n)` (L277-301): Complex algorithm handling timeouts and multiple waiters
- `wait_for(predicate, timeout)` (L306-322): Waits until predicate returns True

**Event (L328-365)** - Simple signaling mechanism
- Built on Condition + Semaphore, provides set/clear/wait interface
- `is_set()`, `set()`, `clear()`, `wait()` methods for event coordination

**Barrier (L370-404)** - Synchronization point for multiple processes
- Inherits from `threading.Barrier`, uses shared memory via BufferWrapper
- State stored in memory-mapped integer array for cross-process coordination

## Dependencies & Architecture

**Critical Dependencies:**
- `_multiprocessing.SemLock`: Low-level semaphore implementation (L28-33)
- Platform-specific behavior: Windows vs Unix handling differs significantly (L54, L70-80, L103-111)
- Context system: All objects require multiprocessing context for proper resource management

**Key Patterns:**
- Resource tracking via `.resource_tracker` for cleanup on Unix systems
- Fork vs spawn context validation prevents cross-context sharing errors
- Retry logic with random naming prevents semaphore name collisions
- Dynamic method binding from underlying semlock objects

**Constants:**
- `RECURSIVE_MUTEX = 0, SEMAPHORE = 1` (L39): Semlock type discriminators
- `SEM_VALUE_MAX`: Platform maximum semaphore value (L40)

## Critical Invariants

1. Platform check at import: Module raises ImportError if sem_open unavailable (L27-33)
2. Context consistency: Objects created in fork context cannot be shared with spawn processes (L107-110)
3. Lock ownership: Condition.wait/notify operations require lock ownership (L255-256, L278)
4. Resource cleanup: Unix systems require explicit semaphore unlinking via resource tracker (L75-82)
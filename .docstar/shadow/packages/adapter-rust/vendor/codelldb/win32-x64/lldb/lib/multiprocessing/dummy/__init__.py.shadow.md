# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/dummy/__init__.py
@source-hash: 9127a40ea0ff342c
@generated: 2026-02-09T18:06:10Z

**Purpose**: Thread-based multiprocessing dummy adapter that provides the multiprocessing API using threading primitives instead of true multiprocessing. Part of Python's multiprocessing package fallback mechanism.

**Core Architecture**:
- **DummyProcess (L34-59)**: Threading.Thread subclass that mimics multiprocessing.Process behavior
  - Maintains parent-child relationships via `_children` WeakKeyDictionary (L39)
  - Validates parent context on start() to prevent cross-thread issues (L44-47)
  - Provides exitcode property that returns 0 for completed threads, None otherwise (L54-58)

**Key Functions**:
- **current_process (L65)**: Aliased to threading.current_thread, maintains _children registry (L66)
- **active_children (L68-73)**: Returns live child processes, auto-cleaning dead references
- **freeze_support (L75-76)**: No-op placeholder for multiprocessing compatibility
- **Manager (L116-117)**: Returns current module as manager object
- **Pool (L122-124)**: Creates ThreadPool from parent pool module
- **Array (L97-98)**: Returns standard array.array (no shared memory)

**Data Structures**:
- **Namespace (L82-92)**: Generic attribute container with filtered repr (excludes underscore attributes)
- **Value (L100-114)**: Simple value wrapper with typecode metadata, no synchronization

**Import Strategy**:
- Directly imports threading synchronization primitives (L26-27): Lock, RLock, Semaphore, etc.
- Imports Queue from queue module (L28)
- Imports Pipe from local connection module (L25)

**API Compatibility**:
- Exports multiprocessing-compatible interface via __all__ (L10-14)
- Aliases dict=dict, list=list for namespace consistency (L94-95)
- JoinableQueue aliased to Queue (L126)

**Critical Constraints**:
- No true isolation - all "processes" share same memory space
- Parent validation prevents starting processes from wrong thread context
- WeakKeyDictionary prevents memory leaks from dead thread references
- Lock parameters ignored in Array/Value constructors (threading context)
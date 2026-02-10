# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/pool.py
@source-hash: 418cd41ea5c341e6
@generated: 2026-02-09T18:11:21Z

## Pool - Multiprocessing Process/Thread Pool Implementation

### Primary Purpose
Provides the `Pool` and `ThreadPool` classes for parallel execution of functions across multiple processes or threads. Core multiprocessing module implementation that manages worker processes, task distribution, and result collection.

### Key Classes and Functions

**Pool (L173-740)** - Main process pool class
- `__init__(L183-262)` - Initializes pool with worker processes, queues, and handler threads
- `apply(L355-360)` / `apply_async(L453-461)` - Execute single function synchronously/asynchronously
- `map(L362-367)` / `map_async(L463-469)` - Apply function to iterable items
- `starmap(L369-375)` / `starmap_async(L377-383)` - Map with argument unpacking
- `imap(L396-423)` / `imap_unordered(L425-451)` - Iterator-based mapping with lazy evaluation
- `close(L647-652)` / `terminate(L654-657)` / `join(L659-669)` - Pool lifecycle management

**Worker Management**
- `worker(L97-140)` - Worker process main function that processes tasks from queue
- `_handle_workers(L507-525)` - Thread that maintains worker pool, handles restarts
- `_handle_tasks(L528-571)` - Thread that distributes tasks to workers
- `_handle_results(L574-631)` - Thread that collects results from workers

**Result Classes**
- `ApplyResult(L745-784)` - Handles single async operation results
- `MapResult(L794-831)` - Handles chunked map operation results  
- `IMapIterator(L837-900)` - Ordered iterator for imap results
- `IMapUnorderedIterator(L906-915)` - Unordered iterator for imap results

**ThreadPool (L921-956)** - Thread-based pool subclass
- Overrides process-specific methods to use threads instead of processes
- `Process(L925-927)` - Returns dummy.Process (thread) instead of real process

**Utility Classes**
- `_PoolCache(L150-171)` - Dictionary that notifies pool when emptied
- `RemoteTraceback(L57-61)` / `ExceptionWithTraceback(L63-74)` - Exception handling for cross-process errors
- `MaybeEncodingError(L80-94)` - Wraps unpickleable exceptions

### Important Dependencies
- `multiprocessing.get_context()` - Process creation context
- `queue.SimpleQueue` - Thread-safe queuing
- `threading` - Handler thread management
- `multiprocessing.connection.wait` - Waiting on multiple connections

### Key Architectural Patterns
- **Three-thread architecture**: Worker handler, task handler, result handler run concurrently
- **Queue-based communication**: Tasks and results flow through SimpleQueues
- **Chunking strategy**: Large iterables split into chunks for load balancing
- **Sentinel-based shutdown**: None values signal threads/processes to terminate
- **State machine**: Pool states (INIT/RUN/CLOSE/TERMINATE) control lifecycle

### Critical Invariants
- Pool must be in RUN state for task submission
- Worker handler maintains exact process count through restarts
- Cache emptying triggers pool maintenance notifications
- All handler threads must be joined before pool destruction
- Sentinels (None) must be sent to all workers during shutdown

### Configuration Constants
- Pool states: `INIT(L36)`, `RUN(L37)`, `CLOSE(L38)`, `TERMINATE(L39)`
- Default chunk calculation: `len(iterable) / (pool_size * 4)` with minimum 1
- Job counter: Global `itertools.count()` for unique job IDs
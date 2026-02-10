# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/util.py
@source-hash: 6752c4515ec69f82
@generated: 2026-02-09T18:06:22Z

## Primary Purpose
Core utility module for Python's multiprocessing package providing logging, finalization, fork-aware types, and process management utilities. Acts as foundational infrastructure for multiprocessing operations.

## Key Components

### Logging Infrastructure (L32-103)
- **Constants**: Custom logging levels SUBDEBUG (5), SUBWARNING (25) alongside standard levels
- **Logging functions**: `sub_debug()` (L44), `debug()` (L48), `info()` (L52), `sub_warning()` (L56) - convenience wrappers around logger
- **`get_logger()`** (L60-85): Lazy initialization of multiprocessing logger with cleanup ordering via atexit manipulation
- **`log_to_stderr()`** (L87-103): Configures stderr handler with multiprocessing-specific format

### Abstract Socket Support (L106-126)
- **`_platform_supports_abstract_sockets()`** (L108): Platform detection for Linux/Android abstract namespace sockets
- **`is_abstract_socket_namespace()`** (L116): Validates abstract socket addresses (null-byte prefixed)

### Temporary Directory Management (L132-156)
- **`get_temp_dir()`** (L144): Creates/retrieves process-specific temp directory with automatic cleanup
- **`_remove_temp_dir()`** (L132): Cleanup callback handling FileNotFoundError gracefully

### Fork Reinitialization Registry (L162-175)
- **After-fork registry**: WeakValueDictionary tracking objects needing post-fork reinitialization
- **`register_after_fork()`** (L174): Registers object/function pairs for post-fork execution
- **`_run_after_forkers()`** (L165): Executes registered callbacks after fork

### Finalization System (L181-309)
- **`Finalize` class** (L185-268): Weakref-based object finalization with priority support
  - `__init__()` (L189): Sets up weakref callback with optional exit priority
  - `__call__()` (L208): Executes callback with process ID validation
  - `cancel()` (L232): Cancels pending finalization
- **`_run_finalizers()`** (L271): Executes finalizers by priority order, handles registry mutations

### Exit Management (L315-365)
- **`is_exiting()`** (L315): Global shutdown state check
- **`_exit_function()`** (L323): Comprehensive cleanup handling daemon termination, process joining, finalizer execution

### Fork-Aware Types (L371-392)
- **`ForkAwareThreadLock`** (L371): Thread lock that reinitializes after fork
- **`ForkAwareLocal`** (L388): Thread-local storage that clears after fork

### File Descriptor Management (L398-470)
- **`close_all_fds_except()`** (L403): Closes all FDs except specified list using os.closerange()
- **`spawnv_passfds()`** (L450): Spawns process with only specified FDs kept open
- **`_close_stdin()`** (L413): Safely redirects stdin to /dev/null
- **`_flush_std_streams()`** (L436): Flushes stdout/stderr with error handling

### Test Cleanup (L472-493)
- **`_cleanup_tests()`** (L472): Comprehensive cleanup for test environments including ForkServer, ResourceTracker

## Critical Dependencies
- **Threading integration**: Explicit threading import (L15) to ensure cleanup ordering
- **Weakref-based lifecycle management**: Prevents circular references in finalization
- **Process module integration**: Current process state and active children management

## Architectural Patterns
- **Lazy initialization**: Logger and temp directory created on first access
- **Weak reference cleanup**: Finalize class uses weakrefs to avoid keeping objects alive
- **Priority-based execution**: Finalizers execute by priority with reverse creation order
- **Fork safety**: Special handling for locks and thread-local storage across process boundaries
- **Global state management**: Module-level registries with careful shutdown handling

## Critical Invariants
- Exit function must execute finalizers before terminating daemon processes
- Fork-aware objects must register for reinitialization to prevent deadlocks
- Finalizers with same priority execute in reverse creation order
- Process ID validation prevents cross-process finalizer execution